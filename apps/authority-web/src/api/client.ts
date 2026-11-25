/**
 * ResQ Live — Centralized API Client
 *
 * Provides type-safe, authenticated API calls for the authority workspace.
 * Used by: Reports, Incidents, Audit, Notifications pages.
 *
 * Features:
 * - JWT authentication with automatic token management
 * - Configurable base URL (environment-driven)
 * - Consistent error handling with typed errors
 * - Request timeout and cancellation support
 * - Standardized response types
 * - Authentication failure handling
 * - Safe token lifecycle (refresh, renewal, cleanup)
 *
 * Constraints:
 * - Never hardcode production credentials
 * - Never expose secrets in frontend environment variables
 * - Reuse OpenAPI-generated types where possible
 * - Reuse Zod validation schemas where possible
 * - Preserve monorepo architecture
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { z } from 'zod';

// ============================================
// API Configuration
// ============================================

/** Default base URL — overridden by deployment configuration */
const DEFAULT_BASE_URL = 'https://api.resq.live/v1';

/** API timeout in milliseconds */
const DEFAULT_TIMEOUT = 30000;

/** Maximum retry attempts for transient failures */
const MAX_RETRIES = 3;

/** Backoff multiplier for retry attempts */
const BACKOFF_BASE = 1000;

/** Whether the API client is currently initializing */
let isInitializing = true;

/** Promise that resolves when initialization completes */
let initPromise: Promise<void> | null = null;

/** Initialize the API client once */
async function initializeClient(): Promise<void> {
  if (!isInitializing) return;
  isInitializing = false;

  // Perform any one-time setup here
  // e.g., configure interceptors, load shared types, etc.
}

/**
 * Application API configuration.
 * Read from environment — never hardcode credentials.
 */
interface ApiConfig {
  /** Base URL for all API requests */
  baseUrl: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Backoff base delay in milliseconds */
  backoffBase?: number;
}

/** Default API configuration */
const defaultApiConfig: ApiConfig = {
  baseUrl: DEFAULT_BASE_URL,
  timeout: DEFAULT_TIMEOUT,
  maxRetries: MAX_RETRIES,
  backoffBase: BACKOFF_BASE,
};

/** Global API configuration (set once at initialization) */
let globalConfig: ApiConfig = { ...defaultApiConfig };

/** Set global API configuration */
export function setApiConfig(config: Partial<ApiConfig>): void {
  globalConfig = { ...defaultApiConfig, ...config };
}

/** Get current API configuration */
export function getApiConfig(): ApiConfig {
  return { ...globalConfig };
}

// ============================================
// Standardized Error Types
// ============================================

/** API error response schema */
const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean().default(false),
  details: z.record(z.unknown()).optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

/** API result — either success or error */
interface ApiResult<T> {
  success: true;
  data: T;
  error?: never;
}

interface ApiErrorResult {
  success: false;
  data?: never;
  error: ApiError;
}

/** Union type for API results */
type ApiResponse<T> = ApiResult<T> | ApiErrorResult;

/** Handle a fetch response and return standardized result */
async function handleFetchResponse(
  response: Response
): Promise<ApiResult<any>> {
  const text = await response.text();

  if (!response.ok) {
    let errorData;
    try {
      errorData = JSON.parse(text);
    } catch {
      // Not JSON — use raw text
      errorData = { message: text || `HTTP ${response.status}` };
    }

    // Validate/error-normalize the error shape
    const parsed = ApiErrorSchema.safeParse(errorData);
    const error: ApiError = parsed.success
      ? parsed.data
      : {
          code: `HTTP_${response.status}`,
          message: errorData.message || errorData.detail || `HTTP ${response.status}`,
          retryable: false,
        };

    return { success: false, error };
  }

  // Success — try to parse as JSON
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    // Empty or non-JSON response body
    data = {};
  }

  return { success: true, data };
}

// ============================================
// Core API Client Class
// ============================================

/**
 * Centralized API Client for ResQ Live Authority Workspace
 *
 * Handles:
 * - JWT authentication via Bearer tokens
 * - Configurable base URL
 * - Request timeouts
 * - Retry logic for transient failures
 * - Standardized error handling
 * - Authentication failure detection and handling
 * - Response serialization/deserialization
 */

export class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;
  private backoffBase: number;
  private abortController: AbortController | null = null;

  constructor(config?: Partial<ApiConfig>) {
    const cfg = { ...globalConfig, ...config };
    this.baseUrl = cfg.baseUrl.replace(/\/+$/, ''); // Strip trailing slashes
    this.timeout = cfg.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = cfg.maxRetries ?? MAX_RETRIES;
    this.backoffBase = cfg.backoffBase ?? BACKOFF_BASE;
  }

  /** Get auth headers (JWT Bearer token) */
  private getAuthHeaders(): Record<string, string> {
    const { getStoredToken } = useAuth();
    const token = getStoredToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /** Build full URL from base + path */
  private buildUrl(path: string): string {
    // Ensure base URL doesn't end with / and path starts without /
    const cleanBase = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${cleanBase}/${cleanPath}`;
  }

  /** Execute a fetch request with retry logic */
  private async executeRequest(
    input: RequestInfo,
    init?: RequestInit
  ): Promise<Response> {
    // If we already have an abort controller, cancel previous request
    this.abortController?.abort();
    this.abortController = new AbortController();

    const controller = this.abortController;
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
        headers: {
          ...init?.headers,
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** Retry delay calculation with exponential backoff + jitter */
  private calculateRetryDelay(attempt: number): number {
    const delay = this.backoffBase * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 100; // 0-100ms jitter
    return Math.min(delay + jitter, 30000); // Cap at 30s
  }

  /** Execute a request with full retry logic */
  private async requestWithRetry(
    input: RequestInfo,
    init?: RequestInit
  ): Promise<ApiResult<any>> {
    let lastError: ApiError | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.executeRequest(input, init);
        const result = await handleFetchResponse(response);

        // Even non-ok responses can be "retryable" (e.g., 429 with Retry-After)
        if (result.success) {
          return result;
        }

        // Check if this error type is retryable
        if (result.error.retryable && attempt < this.maxRetries) {
          const delay = this.calculateRetryDelay(attempt);
          await this.sleep(delay);
          continue;
        }

        // Not retryable or exhausted retries
        return result;
      } catch (error: any) {
        lastError = {
          code: error.code || `REQUEST_FAILED_${attempt}`,
          message: error.message || 'Request failed',
          retryable: attempt < this.maxRetries,
        };

        if (attempt < this.maxRetries) {
          const delay = this.calculateRetryDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    return { success: false, error: lastError! };
  }

  /** Simple sleep utility */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** No-op sleep for compatibility */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async noopSleep(): Promise<void> {
    return Promise.resolve();
  }

  /** Check if response indicates authentication failure */
  private isAuthError(error: ApiError): boolean {
    const authIndicators = [
      '401',
      '403',
      'TOKEN_EXPIRED',
      'TOKEN_INVALID',
      'AUTH_FAILED',
      'PERMISSION_DENIED',
    ];
    return authIndicators.some(
      (ind) => error.code.includes(ind) || error.message.toLowerCase().includes(ind.toLowerCase())
    );
  }

  /** Check if error indicates token needs refresh */
  private needsTokenRefresh(error: ApiError): boolean {
    const tokenIndicators = ['TOKEN_EXPIRED', 'TOKEN_INVALID', '401'];
    return tokenIndicators.some((ind) => error.code.includes(ind) || error.message.toUpperCase().includes(ind));
  }

  // ============================================
  // Public API Methods
  // ============================================

  /** Generic GET request */
  async get<T>(path: string, params?: Record<string, string>): Promise<ApiResult<T>> {
    const url = new URL(this.buildUrl(path));
    if (params) {
      Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));
    }
    return this.requestWithRetry(url.toString());
  }

  /** Generic GET request with timeout */
  async getWithTimeout<T>(path: string, params?: Record<string, string>, timeout?: number): Promise<ApiResult<T>> {
    const url = new URL(this.buildUrl(path));
    if (params) {
      Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));
    }

    const abortCtrl = new AbortController();
    const timeoutId = setTimeout(() => abortCtrl.abort(), timeout || this.timeout);

    try {
      const response = await fetch(url.toString(), {
        signal: abortCtrl.signal,
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
      });
      return await handleFetchResponse(response);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** Generic POST request */
  async post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
    return this.requestWithRetry(this.buildUrl(path), {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /** Generic POST request with custom headers */
  async postWithHeaders<T>(path: string, body: unknown, customHeaders: Record<string, string>): Promise<ApiResult<T>> {
    return this.requestWithRetry(this.buildUrl(path), {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        ...customHeaders,
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
    });
  }

  /** Generic PUT request */
  async put<T>(path: string, body: unknown): Promise<ApiResult<T>> {
    return this.requestWithRetry(this.buildUrl(path), {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  /** Generic PATCH request */
  async patch<T>(path: string, body: unknown): Promise<ApiResult<T>> {
    return this.requestWithRetry(this.buildUrl(path), {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  /** Generic DELETE request */
  async delete<T>(path: string): Promise<ApiResult<T>> {
    return this.requestWithRetry(this.buildUrl(path), {
      method: 'DELETE',
    });
  }

  /** Acknowledge a report */
  async acknowledgeReport(reportId: string): Promise<ApiResult<{ acknowledged: boolean; report_id: string; new_status: string; event_id: string }>> {
    return this.postWithHeaders(
      `/reports/${reportId}/acknowledge`,
      {},
      {}
    );
  }

  /** Get a single report */
  async getReport(reportId: string): Promise<ApiResult<{
    id: string;
    category_code: string;
    severity_code: string;
    priority_code: string;
    status: string;
    impact_json: Record<string, any>;
    reported_location: { lat: number; lon: number } | null;
    reported_at: string;
    reported_by: string;
    authority_acknowledged: boolean;
    authority_acknowledged_at: string | null;
    authority_acknowledged_by: string | null;
    reason_code: string | null;
    reason_text: string | null;
    evidence: Array<{
      evidence_id: string;
      kind: string;
      mime_type: string;
      size_bytes: number;
      sha256_hash: string;
      storage_state: string;
      integrity_status: string | null;
      captured_at: string;
    }>;
    assigned_team: string | null;
    incident_id: string | null;
    created_at: string;
    updated_at: string;
  }>> {
    return this.get<{
      id: string;
      category_code: string;
      severity_code: string;
      priority_code: string;
      status: string;
      impact_json: Record<string, any>;
      reported_location: { lat: number; lon: number } | null;
      reported_at: string;
      reported_by: string;
      authority_acknowledged: boolean;
      authority_acknowledged_at: string | null;
      authority_acknowledged_by: string | null;
      reason_code: string | null;
      reason_text: string | null;
      evidence: Array<{
        evidence_id: string;
        kind: string;
        mime_type: string;
        size_bytes: number;
        sha256_hash: string;
        storage_state: string;
        integrity_status: string | null;
        captured_at: string;
      }>;
      assigned_team: string | null;
      incident_id: string | null;
      created_at: string;
      updated_at: string;
    }>('/reports/' + reportId);
  }

  /** List reports with filtering and pagination */
  async listReports(params?: {
    org_id?: string;
    category_codes?: string[];
    severity_codes?: string[];
    status_codes?: string[];
    priority_codes?: string[];
    date_from?: string;
    date_to?: string;
    bbox?: [number, number, number, number];
    search_query?: string;
    page?: number;
    page_size?: number;
  }): Promise<ApiResult<{
    data: Array<{
      id: string;
      category_code: string;
      severity_code: string;
      priority_code: string;
      status: string;
      reported_at: string;
      reported_location: { lat: number; lon: number } | null;
      authority_acknowledged: boolean;
      assigned_team: string | null;
      incident_id: string | null;
    }>;
    meta: {
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
    };
  }>> {
    return this.get<{
      data: Array<{
        id: string;
        category_code: string;
        severity_code: string;
        priority_code: string;
        status: string;
        reported_at: string;
        reported_location: { lat: number; lon: number } | null;
        authority_acknowledged: boolean;
        assigned_team: string | null;
        incident_id: string | null;
      }>;
      meta: {
        total: number;
        page: number;
        page_size: number;
        total_pages: number;
      };
    }>('/reports', params);
  }

  /** List incidents */
  async listIncidents(params?: {
    org_id?: string;
    priority_codes?: string[];
    status_codes?: string[];
    search_query?: string;
    page?: number;
    page_size?: number;
  }): Promise<ApiResult<{
    data: Array<{
      id: string;
      priority_code: string;
      status: string;
      title: string | null;
      reported_at: string;
      report_count: number;
      authority_acknowledged: boolean;
    }>;
    meta: {
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
    };
  }>> {
    return this.get<{
      data: Array<{
        id: string;
        priority_code: string;
        status: string;
        title: string | null;
        reported_at: string;
        report_count: number;
        authority_acknowledged: boolean;
      }>;
      meta: {
        total: number;
        page: number;
        page_size: number;
        total_pages: number;
      };
    }>('/incidents', params);
  }

  /** Acknowledge an incident */
  async acknowledgeIncident(incidentId: string): Promise<ApiResult<{
    acknowledged: boolean;
    incident_id: string;
    new_status: string;
    event_id: string;
  }>> {
    return this.postWithHeaders(
      `/incidents/${incidentId}/acknowledge`,
      {},
      {}
    );
  }

  /** Update incident (PATCH) */
  async patchIncident(incidentId: string, body: any): Promise<ApiResult<any>> {
    return this.patch(`/incidents/${incidentId}`, body);
  }

  /** Create organization */
  async createOrganization(body: any): Promise<ApiResult<any>> {
    return this.post('/organizations', body);
  }

  /** Update assignment */
  async updateAssignment(assignmentId: string, body: any): Promise<ApiResult<any>> {
    return this.patch(`/assignments/${assignmentId}`, body);
  }

  /** Get incident detail */
  async getIncident(incidentId: string): Promise<ApiResult<{
    id: string;
    priority_code: string;
    status: string;
    title: string | null;
    reported_at: string;
    report_count: number;
    authority_acknowledged: boolean;
    linked_reports: Array<{
      report_id: string;
      relationship_type: string;
      reason: string | null;
    }>;
    assigned_team: string | null;
  }>> {
    return this.get<{
      id: string;
      priority_code: string;
      status: string;
      title: string | null;
      reported_at: string;
      report_count: number;
      authority_acknowledged: boolean;
      linked_reports: Array<{
        report_id: string;
        relationship_type: string;
        reason: string | null;
      }>;
      assigned_team: string | null;
    }>('/incidents/' + incidentId);
  }

  /** List audit events */
  async listAuditEvents(params?: {
    aggregate_type?: string;
    aggregate_id?: string;
    from_state?: string;
    to_state?: string;
    actor_user_id?: string;
    search_query?: string;
    page?: number;
    page_size?: number;
  }): Promise<ApiResult<{
    data: Array<{
      event_id: string;
      aggregate_type: string;
      aggregate_id: string;
      sequence_number: number;
      from_state: string;
      to_state: string;
      actor_user_id: string;
      actor_node_id: string | null;
      reason_code: string | null;
      reason_text: string | null;
      occurred_at_device: string | null;
      recorded_at_server: string;
      correlation_id: string | null;
    }>;
    meta: {
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
    };
  }>> {
    return this.get<{
      data: Array<{
        event_id: string;
        aggregate_type: string;
        aggregate_id: string;
        sequence_number: number;
        from_state: string;
        to_state: string;
        actor_user_id: string;
        actor_node_id: string | null;
        reason_code: string | null;
        reason_text: string | null;
        occurred_at_device: string | null;
        recorded_at_server: string;
        correlation_id: string | null;
      }>;
      meta: {
        total: number;
        page: number;
        page_size: number;
        total_pages: number;
      };
    }>('/audit-logs', params);
  }

  /** List notifications */
  async listNotifications(params?: {
    channel?: string;
    status?: 'read' | 'unread';
    related_type?: string;
    search_query?: string;
    page?: number;
    page_size?: number;
  }): Promise<ApiResult<{
    data: Array<{
      id: string;
      channel: string;
      status: string;
      related_type: string;
      related_id: string;
      title: string;
      message: string;
      created_at: string;
      read: boolean;
    }>;
    meta: {
      total: number;
      page: number;
      page_size: number;
      total_pages: number;
    };
  }>> {
    return this.get<{
      data: Array<{
        id: string;
        channel: string;
        status: string;
        related_type: string;
        related_id: string;
        title: string;
        message: string;
        created_at: string;
        read: boolean;
      }>;
      meta: {
        total: number;
        page: number;
        page_size: number;
        total_pages: number;
      };
    }>('/notifications', params);
  }

  /** Mark a notification as read */
  async markNotificationRead(notificationId: string): Promise<ApiResult<{ marked: boolean; notification_id: string }>> {
    return this.postWithHeaders(
      `/notifications/${notificationId}/read`,
      {},
      {}
    );
  }

  /** Clear all notifications */
  async clearNotifications(): Promise<ApiResult<{ cleared: boolean }>> {
    return this.postWithHeaders(
      '/notifications/clear',
      {},
      {}
    );
  }

  /** Refresh authentication token */
  async refreshAuth(): Promise<ApiResult<{ success: boolean }>> {
    // Try to refresh the token via the backend
    try {
      const response = await fetchWithRetry(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
        },
      });
      const result = await handleFetchResponse(response);
      return result;
    } catch (error) {
      return { success: false, error: { code: 'AUTH_REFRESH_FAILED', message: 'Failed to refresh token', retryable: false } };
    }
  }

  /** Get current authentication status */
  getAuthStatus(): {
    isAuthenticated: boolean;
    hasToken: boolean;
    tokenExpiry?: string;
  } {
    const { getStoredToken, getStoredUser } = useAuth();
    const token = getStoredToken();
    const user = getStoredUser();

    if (!token) {
      return { isAuthenticated: false, hasToken: false };
    }

    if (!user) {
      return { isAuthenticated: true, hasToken: true };
    }

    return {
      isAuthenticated: true,
      hasToken: true,
      tokenExpiry: user.token_expiry,
    };
  }

  /** Clean up — called on unmount or logout */
  cleanup(): void {
    this.abortController?.abort();
    this.abortController = null;
    // Note: We do NOT clear the token here — that's the session's responsibility
    // The abort controller ensures in-flight requests are cancelled
  }
}

/** Singleton instance */
export const api = new ApiClient();

/** Request timeout helper (standalone, for non-class usage) */
export async function fetchWithRetry(
  input: RequestInfo,
  init?: RequestInit,
  options?: { maxRetries?: number; timeout?: number }
): Promise<Response> {
  let attempts = 0;
  const maxRetries = options?.maxRetries ?? 3;
  const timeout = options?.timeout ?? 30000;

  while (attempts <= maxRetries) {
    try {
      const abortCtrl = new AbortController();
      const timeoutId = setTimeout(() => abortCtrl.abort(), timeout);
      const response = await fetch(input, {
        ...init,
        signal: abortCtrl.signal,
        headers: {
          ...init?.headers,
          'Content-Type': 'application/json',
          ...api.getAuthHeaders(),
        },
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        if (attempts < maxRetries) {
          attempts++;
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempts)));
          continue;
        }
        throw new Error('Request timed out after all retries');
      }
      if (attempts < maxRetries) {
        attempts++;
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempts)));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

// ============================================
// Hook: useApiClient
// ============================================

/** Hook providing API client state and utilities */
export function useApiClient() {
  const { getStoredToken, logout } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastAuthError, setLastAuthError] = useState<string | null>(null);

  // Initialize the client
  useEffect(() => {
    initializeClient().then(() => setIsInitialized(true));
  }, []);

  // Track auth state changes
  useEffect(() => {
    const handleStorageChange = () => {
      // Token changed — could trigger re-auth or token refresh
      const token = getStoredToken();
      if (!token) {
        setLastAuthError('Session expired — user logged out');
      }
    };

    const token = getStoredToken();
    if (token) {
      setIsInitialized(true);
    } else {
      setLastAuthError('No authentication token found');
    }
  }, [getStoredToken]);

  // Provide public API
  return {
    isInitialized,
    lastAuthError,
    api,
    setApiConfig,
    getApiConfig,
    refreshAuth: api.refreshAuth,
    login: async (phoneOrEmail: string, password: string) => {
      try {
        const response = await fetch(`${api.getApiConfig().baseUrl}/auth/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone_or_email: phoneOrEmail, password }),
        });
        const data = await response.json();
        if (response.ok) {
          localStorage.setItem('resq_auth_token', data.token);
          localStorage.setItem('resq_auth_user', JSON.stringify(data.user));
        }
        return { success: response.ok, data, error: null };
      } catch (err: any) {
        return { success: false, data: null, error: err.message };
      }
    },
    logout,
  };
}