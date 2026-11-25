/**
 * @resq/sync-client - TypeScript sync protocol client for ResQ Live
 *
 * Implements the durable outbox/inbox synchronization pattern with cursor-based pulls.
 * Used by: Android (via Kotlin/JS bridge or reimplemented), Electron Desktop, EOC Node.
 */

import { z } from 'zod';

// ============================================
// Sync Protocol Types (matching backend sync tables)
// ============================================

/** Sync event structure for push */
export const syncEventSchema = z.object({
  event_id: z.string().uuid(),
  sequence: z.number().int().positive(),
  aggregate_type: z.string(),
  aggregate_id: z.string().uuid(),
  event_type: z.string(),
  schema_version: z.number().int().positive(),
  occurred_at_device: z.string().datetime(),
  payload_hash: z.string().regex(/^[a-f0-9]{64}$/),
  payload: z.record(z.unknown()),
});

export type SyncEvent = z.infer<typeof syncEventSchema>;

/** Push events request */
export const pushEventsRequestSchema = z.object({
  origin_node_id: z.string().uuid(),
  stream_name: z.string(),
  events: z.array(syncEventSchema),
});

export type PushEventsRequest = z.infer<typeof pushEventsRequestSchema>;

/** Push events response */
export const pushEventsResponseSchema = z.object({
  accepted: z.number().int().nonnegative(),
  already_processed: z.number().int().nonnegative(),
  errors: z.array(
    z.object({
      event_id: z.string().uuid(),
      code: z.string(),
      message: z.string(),
    })
  ),
});

export type PushEventsResponse = z.infer<typeof pushEventsResponseSchema>;

/** Pull changes query */
export const pullChangesQuerySchema = z.object({
  stream_name: z.string(),
  cursor: z.string().nullable().optional(),
  limit: z.number().int().positive().max(200).default(100),
});

export type PullChangesQuery = z.infer<typeof pullChangesQuerySchema>;

/** Pull changes response */
export const pullChangesResponseSchema = z.object({
  events: z.array(syncEventSchema),
  cursor: z.string().nullable(),
  has_more: z.boolean(),
});

export type PullChangesResponse = z.infer<typeof pullChangesResponseSchema>;

// ============================================
// Local Storage Interfaces (for outbox/inbox/cursors)
// ============================================

/** Local outbox entry */
export interface LocalOutboxEntry {
  id: string; // UUID
  origin_node_id: string;
  sequence: number;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  schema_version: number;
  occurred_at_device: string;
  payload_hash: string;
  payload: Record<string, unknown>;
  delivery_state: 'pending' | 'sent' | 'acknowledged' | 'failed' | 'dead_letter';
  attempts: number;
  next_attempt_at: string | null;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
}

/** Local inbox entry (for deduplication) */
export interface LocalInboxEntry {
  id: string;
  origin_node_id: string;
  event_id: string;
  received_at: string;
  payload_hash: string;
  processing_result: 'accepted' | 'already_processed' | 'version_conflict' | 'schema_mismatch' | 'quarantined';
  server_sequence: number | null;
  response_json: Record<string, unknown> | null;
}

/** Local cursor entry */
export interface LocalCursorEntry {
  id: string;
  consumer_node_id: string;
  stream_name: string;
  last_sequence: number;
  updated_at: string;
}

/** Sync conflict entry */
export interface LocalConflictEntry {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  incoming_event_id: string;
  current_version: number;
  incoming_version: number;
  conflict_type: 'version_mismatch' | 'schema_mismatch' | 'constraint_violation' | 'business_rule';
  resolution_state: 'open' | 'resolved_local_wins' | 'resolved_incoming_wins' | 'resolved_merged';
  resolved_by: string | null;
  resolved_at: string | null;
  local_payload: Record<string, unknown>;
  incoming_payload: Record<string, unknown>;
  created_at: string;
}

// ============================================
// Sync Client Configuration
// ============================================

export interface SyncClientConfig {
  /** Base API URL (e.g., 'https://api.resq-live.org/api/v1') */
  apiBaseUrl: string;
  /** This node's unique identifier */
  nodeId: string;
  /** Node type */
  nodeType: 'mobile' | 'desktop' | 'eoc';
  /** Organization ID this node belongs to */
  organizationId: string;
  /** Access token for authenticated requests */
  accessToken: string;
  /** Device ID for X-Device-ID header */
  deviceId: string;
  /** Optional: Custom fetch implementation */
  fetch?: typeof fetch;
  /** Retry configuration */
  retry?: {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
  };
  /** Batch size for push/pull */
  batchSize?: number;
}

// ============================================
// Sync Client Events
// ============================================

export type SyncEventListener = {
  onPushStart?: (count: number) => void;
  onPushComplete?: (response: PushEventsResponse) => void;
  onPushError?: (error: Error, failedEvents: SyncEvent[]) => void;
  onPullStart?: (streamName: string) => void;
  onPullComplete?: (streamName: string, eventsReceived: number, cursor: string | null) => void;
  onPullError?: (streamName: string, error: Error) => void;
  onConflict?: (conflict: LocalConflictEntry) => void;
  onCursorUpdate?: (streamName: string, cursor: string) => void;
};

// ============================================
// Storage Adapter Interface (implement per platform)
// ============================================

export interface SyncStorageAdapter {
  // Outbox operations
  getOutboxEntries(limit: number, deliveryStates?: LocalOutboxEntry['delivery_state'][]): Promise<LocalOutboxEntry[]>;
  addOutboxEntry(entry: Omit<LocalOutboxEntry, 'id' | 'created_at' | 'updated_at'>): Promise<string>;
  updateOutboxEntry(id: string, updates: Partial<LocalOutboxEntry>): Promise<void>;
  markOutboxAcknowledged(ids: string[]): Promise<void>;
  markOutboxFailed(id: string, errorCode: string, nextAttemptAt: string): Promise<void>;

  // Inbox operations (deduplication)
  checkInboxExists(originNodeId: string, eventId: string): Promise<boolean>;
  addInboxEntry(entry: Omit<LocalInboxEntry, 'id'>): Promise<void>;

  // Cursor operations
  getCursor(consumerNodeId: string, streamName: string): Promise<LocalCursorEntry | null>;
  setCursor(consumerNodeId: string, streamName: string, lastSequence: number): Promise<void>;

  // Conflict operations
  addConflict(conflict: Omit<LocalConflictEntry, 'id' | 'created_at'>): Promise<string>;
  getConflict(id: string): Promise<LocalConflictEntry | null>;
  updateConflict(id: string, updates: Partial<LocalConflictEntry>): Promise<void>;
  getOpenConflicts(aggregateType?: string, aggregateId?: string): Promise<LocalConflictEntry[]>;

  // Transaction support (for cursor safety)
  runInTransaction<T>(fn: () => Promise<T>): Promise<T>;
}

// ============================================
// Sync Client Implementation
// ============================================

export class SyncClient {
  private config: SyncClientConfig;
  private storage: SyncStorageAdapter;
  private listeners: SyncEventListener = {};
  private isSyncing = false;
  private abortController: AbortController | null = null;

  constructor(config: SyncClientConfig, storage: SyncStorageAdapter) {
    this.config = {
      batchSize: 100,
      retry: {
        maxRetries: 5,
        baseDelayMs: 1000,
        maxDelayMs: 60000,
      },
      ...config,
    };
    this.storage = storage;
  }

  /** Register event listeners */
  on(listener: SyncEventListener): void {
    this.listeners = { ...this.listeners, ...listener };
  }

  /** Check if sync is in progress */
  get syncing(): boolean {
    return this.isSyncing;
  }

  /** Abort any in-progress sync */
  abort(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  // ============================================
  // Outbox Management
  // ============================================

  /**
   * Add an event to the local outbox
   * Call this when creating reports, evidence, or any local change that needs sync
   */
  async enqueueEvent(event: Omit<SyncEvent, 'event_id' | 'sequence' | 'occurred_at_device' | 'payload_hash'>): Promise<string> {
    const eventId = crypto.randomUUID();
    const occurredAtDevice = new Date().toISOString();
    const payloadHash = await this.computePayloadHash(event.payload);

    const fullEvent: SyncEvent = {
      ...event,
      event_id: eventId,
      sequence: await this.getNextSequence(),
      occurred_at_device: occurredAtDevice,
      payload_hash: payloadHash,
    };

    return this.storage.addOutboxEntry({
      origin_node_id: this.config.nodeId,
      sequence: fullEvent.sequence,
      aggregate_type: fullEvent.aggregate_type,
      aggregate_id: fullEvent.aggregate_id,
      event_type: fullEvent.event_type,
      schema_version: fullEvent.schema_version,
      occurred_at_device: fullEvent.occurred_at_device,
      payload_hash: fullEvent.payload_hash,
      payload: fullEvent.payload,
      delivery_state: 'pending',
      attempts: 0,
      next_attempt_at: null,
      last_error_code: null,
    });
  }

  /**
   * Get next sequence number for this node
   */
  private async getNextSequence(): Promise<number> {
    const entries = await this.storage.getOutboxEntries(1);
    if (entries.length === 0) return 1;
    return Math.max(...entries.map((e) => e.sequence)) + 1;
  }

  /**
   * Compute SHA-256 hash of payload for deduplication
   */
  private async computePayloadHash(payload: Record<string, unknown>): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // ============================================
  // Push (Client -> Server)
  // ============================================

  /**
   * Push pending outbox events to server
   * Returns number of events successfully acknowledged
   */
  async push(): Promise<number> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    this.abortController = new AbortController();
    let totalAcknowledged = 0;

    try {
      // Get pending events
      const pendingEvents = await this.storage.getOutboxEntries(
        this.config.batchSize!,
        ['pending', 'failed']
      );

      if (pendingEvents.length === 0) {
        return 0;
      }

      this.listeners.onPushStart?.(pendingEvents.length);

      // Convert to sync events
      const syncEvents: SyncEvent[] = pendingEvents.map((entry) => ({
        event_id: entry.id,
        sequence: entry.sequence,
        aggregate_type: entry.aggregate_type,
        aggregate_id: entry.aggregate_id,
        event_type: entry.event_type,
        schema_version: entry.schema_version,
        occurred_at_device: entry.occurred_at_device,
        payload_hash: entry.payload_hash,
        payload: entry.payload,
      }));

      // Push to server
      const response = await this.pushEvents(syncEvents);

      // Handle response
      if (response.accepted > 0) {
        const acceptedIds = syncEvents.slice(0, response.accepted).map((e) => e.event_id);
        await this.storage.markOutboxAcknowledged(acceptedIds);
        totalAcknowledged += response.accepted;
      }

      if (response.already_processed > 0) {
        const processedIds = syncEvents
          .slice(response.accepted, response.accepted + response.already_processed)
          .map((e) => e.event_id);
        await this.storage.markOutboxAcknowledged(processedIds);
        totalAcknowledged += response.already_processed;
      }

      // Handle errors
      for (const error of response.errors) {
        const entry = pendingEvents.find((e) => e.id === error.event_id);
        if (entry) {
          const nextAttemptAt = this.calculateNextAttempt(entry.attempts + 1);
          await this.storage.markOutboxFailed(entry.id, error.code, nextAttemptAt.toISOString());
        }
      }

      this.listeners.onPushComplete?.(response);
      return totalAcknowledged;
    } catch (error) {
      this.listeners.onPushError?.(error as Error, []);
      throw error;
    } finally {
      this.isSyncing = false;
      this.abortController = null;
    }
  }

  /**
   * Internal: Push events to server API
   */
  private async pushEvents(events: SyncEvent[]): Promise<PushEventsResponse> {
    const url = `${this.config.apiBaseUrl}/sync/events`;
    const request: PushEventsRequest = {
      origin_node_id: this.config.nodeId,
      stream_name: 'reports', // Default stream; could be parameterized
      events,
    };

    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Push failed: ${response.status} ${errorData.message || response.statusText}`);
    }

    return pushEventsResponseSchema.parse(await response.json());
  }

  // ============================================
  // Pull (Server -> Client)
  // ============================================

  /**
   * Pull changes for a specific stream
   * Only advances cursor after successful apply (cursor safety)
   */
  async pull(streamName: string): Promise<number> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    this.abortController = new AbortController();
    let totalApplied = 0;

    try {
      this.listeners.onPullStart?.(streamName);

      // Get current cursor
      const cursorEntry = await this.storage.getCursor(this.config.nodeId, streamName);
      const cursor = cursorEntry?.last_sequence ?? 0;

      // Pull changes
      const response = await this.pullChanges(streamName, cursor);

      if (response.events.length === 0) {
        this.listeners.onPullComplete?.(streamName, 0, response.cursor);
        return 0;
      }

      // Apply events in transaction (cursor safety)
      await this.storage.runInTransaction(async () => {
        for (const event of response.events) {
          // Check inbox for deduplication
          const exists = await this.storage.checkInboxExists(event.aggregate_id, event.event_id);
          if (exists) {
            continue; // Already processed
          }

          // Apply event (platform-specific logic would go here)
          await this.applyEvent(event);

          // Record in inbox
          await this.storage.addInboxEntry({
            origin_node_id: this.config.nodeId, // The node that originated the event
            event_id: event.event_id,
            received_at: new Date().toISOString(),
            payload_hash: event.payload_hash,
            processing_result: 'accepted',
            server_sequence: event.sequence,
            response_json: null,
          });

          totalApplied++;
        }

        // Advance cursor ONLY after all events applied successfully
        if (response.cursor) {
          const newSequence = parseInt(response.cursor, 10);
          if (!isNaN(newSequence)) {
            await this.storage.setCursor(this.config.nodeId, streamName, newSequence);
            this.listeners.onCursorUpdate?.(streamName, response.cursor);
          }
        }
      });

      this.listeners.onPullComplete?.(streamName, totalApplied, response.cursor);
      return totalApplied;
    } catch (error) {
      this.listeners.onPullError?.(streamName, error as Error);
      throw error;
    } finally {
      this.isSyncing = false;
      this.abortController = null;
    }
  }

  /**
   * Internal: Pull changes from server API
   */
  private async pullChanges(streamName: string, cursor: number): Promise<PullChangesResponse> {
    const params = new URLSearchParams({
      stream_name: streamName,
      limit: String(this.config.batchSize!),
    });
    if (cursor > 0) {
      params.set('cursor', String(cursor));
    }

    const url = `${this.config.apiBaseUrl}/sync/changes?${params.toString()}`;

    const response = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Pull failed: ${response.status} ${errorData.message || response.statusText}`);
    }

    return pullChangesResponseSchema.parse(await response.json());
  }

  /**
   * Apply a sync event to local state
   * Override this in platform-specific implementations
   */
  protected async applyEvent(event: SyncEvent): Promise<void> {
    // This is a hook for platform-specific implementations
    // Android: Update Room database
    // Desktop: Update SQLite via Electron IPC
    // EOC: Update local PostgreSQL
    console.log(`[SyncClient] Applying event: ${event.event_type} for ${event.aggregate_type}:${event.aggregate_id}`);
  }

  // ============================================
  // Conflict Handling
  // ============================================

  /**
   * Handle a version conflict from server
   * Quarantines the conflict for manual resolution
   */
  async handleConflict(
    aggregateType: string,
    aggregateId: string,
    incomingEvent: SyncEvent,
    currentVersion: number,
    localPayload: Record<string, unknown>
  ): Promise<void> {
    await this.storage.addConflict({
      aggregate_type: aggregateType,
      aggregate_id: aggregateId,
      incoming_event_id: incomingEvent.event_id,
      current_version: currentVersion,
      incoming_version: incomingEvent.payload.version as number ?? 0,
      conflict_type: 'version_mismatch',
      resolution_state: 'open',
      resolved_by: null,
      resolved_at: null,
      local_payload: localPayload,
      incoming_payload: incomingEvent.payload,
    });

    this.listeners.onConflict?.({
      id: '',
      aggregate_type: aggregateType,
      aggregate_id: aggregateId,
      incoming_event_id: incomingEvent.event_id,
      current_version: currentVersion,
      incoming_version: incomingEvent.payload.version as number ?? 0,
      conflict_type: 'version_mismatch',
      resolution_state: 'open',
      resolved_by: null,
      resolved_at: null,
      local_payload: localPayload,
      incoming_payload: incomingEvent.payload,
      created_at: new Date().toISOString(),
    });
  }

  /**
   * Resolve a conflict (local wins, incoming wins, or merged)
   */
  async resolveConflict(
    conflictId: string,
    resolution: 'local_wins' | 'incoming_wins' | 'merged',
    resolvedBy: string,
    mergedPayload?: Record<string, unknown>
  ): Promise<void> {
    const resolutionStateMap = {
      local_wins: 'resolved_local_wins' as const,
      incoming_wins: 'resolved_incoming_wins' as const,
      merged: 'resolved_merged' as const,
    };

    await this.storage.updateConflict(conflictId, {
      resolution_state: resolutionStateMap[resolution],
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
      incoming_payload: mergedPayload ?? {},
    });
  }

  // ============================================
  // Full Sync Cycle
  // ============================================

  /**
   * Perform a full sync cycle: push then pull all streams
   */
  async syncAll(streams: string[] = ['reports', 'incidents', 'assignments', 'authority-updates']): Promise<void> {
    await this.push();

    for (const stream of streams) {
      await this.pull(stream);
    }
  }

  // ============================================
  // HTTP Helpers
  // ============================================

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.accessToken}`,
      'X-Device-ID': this.config.deviceId,
      'X-Correlation-ID': crypto.randomUUID(),
      'Accept': 'application/json',
    };
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    attempt = 0
  ): Promise<Response> {
    const { maxRetries, baseDelayMs, maxDelayMs } = this.config.retry!;

    try {
      const fetchFn = this.config.fetch ?? fetch;
      const response = await fetchFn(url, {
        ...options,
        signal: this.abortController?.signal,
      });

      // Retry on 429, 5xx
      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.min(baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000, maxDelayMs);

        await this.sleep(delay);
        return this.fetchWithRetry(url, options, attempt + 1);
      }

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000, maxDelayMs);
        await this.sleep(delay);
        return this.fetchWithRetry(url, options, attempt + 1);
      }
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private calculateNextAttempt(attempts: number): Date {
    const { baseDelayMs, maxDelayMs } = this.config.retry!;
    const delay = Math.min(baseDelayMs * Math.pow(2, attempts) + Math.random() * 1000, maxDelayMs);
    return new Date(Date.now() + delay);
  }
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create a sync client with default configuration
 */
export function createSyncClient(
  config: Omit<SyncClientConfig, 'fetch'> & { fetch?: typeof fetch },
  storage: SyncStorageAdapter
): SyncClient {
  return new SyncClient(config, storage);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Generate a client-side report ID (UUID v4)
 */
export function generateReportId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a client-side evidence ID (UUID v4)
 */
export function generateEvidenceId(): string {
  return crypto.randomUUID();
}

/**
 * Generate an idempotency key for report submission
 * Combines report_id with timestamp for uniqueness
 */
export function generateIdempotencyKey(reportId: string): string {
  return `${reportId}:${Date.now()}`;
}

/**
 * Validate a sync event structure
 */
export function validateSyncEvent(event: unknown): SyncEvent {
  return syncEventSchema.parse(event);
}

// ============================================
// Export all types and classes
// ============================================

export type {
  SyncClientConfig,
  SyncEventListener,
  SyncStorageAdapter,
  LocalOutboxEntry,
  LocalInboxEntry,
  LocalCursorEntry,
  LocalConflictEntry,
};