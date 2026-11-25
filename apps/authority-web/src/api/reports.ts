/**
 * Authority Workspace Reports API Service
 *
 * Backend API calls for report management from the authority workspace.
 * All endpoints follow the OpenAPI 3.1 contract and use shared types.
 */

import { useAuth } from '@/hooks/use-auth';

/** API base URL - configured per deployment */
const API_BASE = 'https://api.resq.live/v1';

/** Authentication header getter */
function getAuthHeaders(): Record<string, string> {
  const { getStoredToken } = useAuth();
  const token = getStoredToken();
  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
}

/** Report list query parameters */
interface ListReportsParams {
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
}

/** Report list response */
interface ListReportsResponse {
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
}

/** Single report response */
interface GetReportResponse {
  data: {
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
  };
}

/** Acknowledge report response */
interface AcknowledgeReportResponse {
  data: {
    acknowledged: boolean;
    report_id: string;
    new_status: string;
    event_id: string;
  };
}

/** API service class */
export class ReportsApi {
  /** List reports with filtering and pagination */
  static async listReports(params: ListReportsParams = {}): Promise<ListReportsResponse> {
    const headers = getAuthHeaders();
    const queryParams = new URLSearchParams();

    if (params.org_id) queryParams.append('org_id', params.org_id);
    if (params.category_codes?.length) queryParams.append('category_codes', params.category_codes.join(','));
    if (params.severity_codes?.length) queryParams.append('severity_codes', params.severity_codes.join(','));
    if (params.status_codes?.length) queryParams.append('status_codes', params.status_codes.join(','));
    if (params.priority_codes?.length) queryParams.append('priority_codes', params.priority_codes.join(','));
    if (params.date_from) queryParams.append('date_from', params.date_from);
    if (params.date_to) queryParams.append('date_to', params.date_to);
    if (params.bbox) queryParams.append('bbox', params.bbox.join(','));
    if (params.search_query) queryParams.append('search_query', params.search_query);
    if (params.page) queryParams.append('page', String(params.page));
    if (params.page_size) queryParams.append('page_size', String(params.page_size));

    const url = `${API_BASE}/reports?${queryParams.toString()}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to list reports: ${response.status}`);
    }

    return response.json() as Promise<ListReportsResponse>;
  }

  /** Get single report by ID */
  static async getReport(reportId: string): Promise<GetReportResponse> {
    const headers = getAuthHeaders();
    const url = `${API_BASE}/reports/${reportId}`;

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to get report: ${response.status}`);
    }

    return response.json() as Promise<GetReportResponse>;
  }

  /** Acknowledge a report */
  static async acknowledgeReport(reportId: string): Promise<AcknowledgeReportResponse> {
    const headers = {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    };
    const url = `${API_BASE}/reports/${reportId}/acknowledge`;

    const response = await fetch(url, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to acknowledge report: ${response.status}`);
    }

    return response.json() as Promise<AcknowledgeReportResponse>;
  }
}

/** Export a single instance for convenience */
export const reportApi = new ReportsApi();