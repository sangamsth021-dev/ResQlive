/**
 * Shared Zod validation schemas for ResQ Live
 * Used by backend (DTOs, pipes) and clients (forms, API calls)
 */

import { z } from 'zod';

// ============================================
// Common/Reusable Schemas
// ============================================

/** UUID v4 string */
export const uuidSchema = z.string().uuid();

/** ISO 8601 datetime string */
export const isoDateTimeSchema = z.string().datetime();

/** E.164 phone number format */
export const phoneE164Schema = z.string().regex(/^\+[1-9]\d{1,14}$/);

/** Email format */
export const emailSchema = z.string().email();

/** SHA-256 hex string (64 chars) */
export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

/** Pagination cursor (opaque string) */
export const cursorSchema = z.string().nullable().optional();

/** Limit for pagination */
export const limitSchema = z.number().int().positive().max(200).default(50);

/** GeoJSON Point */
export const geoJsonPointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number(), z.number()]), // [longitude, latitude]
});

/** Impact JSON - flexible structured object */
export const impactJsonSchema = z.record(z.unknown());

// ============================================
// Reference Data Enums (match database lookup tables)
// ============================================

/** Incident category codes */
export const incidentCategoryCodeSchema = z.enum([
  'LANDSLIDE',
  'FLOOD',
  'EARTHQUAKE',
  'FIRE',
  'COLLAPSE',
  'HAZMAT',
  'TRANSPORT',
  'MEDICAL',
  'UTILITY',
  'OTHER',
]);

/** Severity codes */
export const severityCodeSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

/** Priority codes */
export const priorityCodeSchema = z.enum(['P1', 'P2', 'P3', 'P4']);

/** Organization types */
export const organizationTypeSchema = z.enum([
  'municipality',
  'authority',
  'police',
  'fire',
  'health',
  'ngo',
  'eoc',
]);

/** Team types */
export const teamTypeSchema = z.enum([
  'search_rescue',
  'medical',
  'fire_suppression',
  'hazmat',
  'engineering',
  'logistics',
  'incident_command',
  'other',
]);

/** Relationship types between reports and incidents */
export const relationshipTypeSchema = z.enum([
  'primary',
  'corroborating',
  'duplicate',
  'related',
  'context_only',
]);

/** Evidence kinds */
export const evidenceKindSchema = z.enum(['photo', 'video', 'audio', 'document']);

/** Reason codes for state transitions */
export const reasonCodeSchema = z.enum([
  'VERIFIED_EVIDENCE',
  'DUPLICATE_REPORT',
  'ASSIGNED_NEARBY',
  'RESOLVED_ACTION_TAKEN',
  'INSUFFICIENT_INFORMATION',
  'OUT_OF_JURISDICTION',
  'FALSE_REPORT',
  'ESCALATED',
  'DE_ESCALATED',
  'REASSIGNED',
  'TEAM_UNAVAILABLE',
  'WEATHER_DELAY',
  'SAFETY_CONCERN',
]);

/** Report state machine */
export const reportStateSchema = z.enum([
  'local_saved',
  'queued',
  'sending',
  'relayed',
  'server_received',
  'authority_acknowledged',
  'under_review',
  'needs_information',
  'verified',
  'duplicate',
  'rejected',
  'closed',
]);

/** Incident state machine */
export const incidentStateSchema = z.enum([
  'new',
  'triaged',
  'verified',
  'assigned',
  'dispatched',
  'response_in_progress',
  'resolved',
  'closed',
]);

/** Assignment state machine */
export const assignmentStateSchema = z.enum([
  'proposed',
  'sent',
  'acknowledged',
  'en_route',
  'on_scene',
  'working',
  'completed',
  'cancelled',
  'declined',
]);

/** Evidence storage states */
export const evidenceStorageStateSchema = z.enum([
  'local_only',
  'upload_pending',
  'uploading',
  'stored',
  'failed',
  'deleted_per_policy',
]);

/** Evidence integrity states */
export const evidenceIntegrityStateSchema = z.enum([
  'pending',
  'checksum_verified',
  'signature_verified',
  'warning',
  'rejected',
]);

/** Evidence access classes */
export const evidenceAccessClassSchema = z.enum([
  'restricted',
  'operational',
  'approved_public_derivative',
]);

/** Location sources */
export const locationSourceSchema = z.enum([
  'GNSS',
  'network',
  'manual',
  'map_pin',
  'unknown',
]);

/** Capture modes */
export const captureModeSchema = z.enum([
  'LIVE_CAMERA',
  'DESKTOP_CAMERA',
  'STRUCTURED_ONLY',
  'APPROVED_IMPORT',
]);

/** Device platforms */
export const devicePlatformSchema = z.enum(['android', 'desktop', 'eoc', 'web']);

/** Device status */
export const deviceStatusSchema = z.enum(['active', 'revoked', 'expired']);

/** Membership roles */
export const membershipRoleSchema = z.enum([
  'reporter',
  'operator',
  'verifier',
  'team_lead',
  'org_admin',
]);

/** Membership status */
export const membershipStatusSchema = z.enum(['active', 'inactive', 'suspended']);

/** Notification channels */
export const notificationChannelSchema = z.enum(['push', 'sms', 'email', 'in_app']);

/** Notification delivery states */
export const deliveryStateSchema = z.enum([
  'pending',
  'sent',
  'delivered',
  'failed',
  'dead_letter',
]);

/** Sync node types */
export const syncNodeTypeSchema = z.enum(['mobile', 'desktop', 'eoc']);

/** Sync node status */
export const syncNodeStatusSchema = z.enum(['active', 'inactive', 'decommissioned']);

/** Sync outbox delivery states */
export const outboxDeliveryStateSchema = z.enum([
  'pending',
  'sent',
  'acknowledged',
  'failed',
  'dead_letter',
]);

/** Sync inbox processing results */
export const inboxProcessingResultSchema = z.enum([
  'accepted',
  'already_processed',
  'version_conflict',
  'schema_mismatch',
  'quarantined',
]);

/** Sync conflict types */
export const conflictTypeSchema = z.enum([
  'version_mismatch',
  'schema_mismatch',
  'constraint_violation',
  'business_rule',
]);

/** Sync conflict resolution states */
export const resolutionStateSchema = z.enum([
  'open',
  'resolved_local_wins',
  'resolved_incoming_wins',
  'resolved_merged',
]);

// ============================================
// Authentication Schemas
// ============================================

/** Create session (login) request */
export const createSessionSchema = z.object({
  phone_e164: phoneE164Schema.optional(),
  email: emailSchema.optional(),
  password: z.string().min(1),
  device_id: uuidSchema.optional(),
}).refine((data) => data.phone_e164 || data.email, {
  message: 'Either phone_e164 or email must be provided',
});

/** Refresh session request */
export const refreshSessionSchema = z.object({
  user_id: uuidSchema,
  device_id: uuidSchema,
  refresh_token: z.string().min(1),
});

/** Session response */
export const sessionResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  user: userPayloadSchema,
});

/** Token response (refresh) */
export const tokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
});

/** User payload (JWT claims) */
export const userPayloadSchema = z.object({
  user_id: uuidSchema,
  device_id: z.string().optional(),
  organization_id: uuidSchema.optional(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
});

// ============================================
// Report Schemas
// ============================================

/** Evidence item in report creation */
export const evidenceItemSchema = z.object({
  evidence_id: uuidSchema,
  kind: evidenceKindSchema,
  mime_type: z.string(),
  size_bytes: z.number().int().nonnegative(),
  sha256_hash: sha256Schema,
});

/** Create report request */
export const createReportSchema = z.object({
  report_id: uuidSchema,
  idempotency_key: z.string().optional(),
  organization_id: uuidSchema.optional(),
  category_code: incidentCategoryCodeSchema,
  severity_code: severityCodeSchema,
  impact_json: impactJsonSchema.optional(),
  location_geom: geoJsonPointSchema.optional(),
  evidence: z.array(evidenceItemSchema).optional(),
});

/** Update report request (amendments) */
export const updateReportSchema = z.object({
  category_code: incidentCategoryCodeSchema.optional(),
  severity_code: severityCodeSchema.optional(),
  impact_json: impactJsonSchema.optional(),
  location_geom: geoJsonPointSchema.nullable().optional(), // allow clearing
  description: z.string().optional(),
});

/** List reports query parameters */
export const listReportsQuerySchema = z.object({
  category_code: z.string().optional(),
  severity_code: z.string().optional(),
  report_status: z.string().optional(),
  cursor: cursorSchema,
  limit: limitSchema,
});

/** Report list response */
export const reportListResponseSchema = z.object({
  reports: z.array(z.record(z.unknown())),
  cursor: z.string().nullable(),
  has_more: z.boolean(),
});

/** Create report response */
export const createReportResponseSchema = z.object({
  report_id: uuidSchema,
  status: z.string(),
  evidence: z.array(
    z.object({
      evidence_id: uuidSchema,
      storage_state: z.string(),
    })
  ),
});

// ============================================
// Evidence Schemas
// ============================================

/** Create upload session request */
export const createUploadSessionSchema = z.object({
  evidence_id: uuidSchema,
  mime_type: z.string(),
  size_bytes: z.number().int().positive(),
  sha256_hash: sha256Schema,
});

/** Complete upload request */
export const completeUploadSchema = z.object({
  evidence_id: uuidSchema,
  sha256_hash: sha256Schema,
});

/** Upload session response */
export const uploadSessionResponseSchema = z.object({
  upload_url: z.string().url(),
  evidence_id: uuidSchema,
  expires_at: isoDateTimeSchema,
});

// ============================================
// Incident Schemas
// ============================================

/** Create incident request */
export const createIncidentSchema = z.object({
  title: z.string().min(1).max(255),
  category_code: incidentCategoryCodeSchema,
  priority_code: priorityCodeSchema,
  location_geom: geoJsonPointSchema.optional(),
  location_accuracy_m: z.number().nonnegative().optional(),
  summary: z.string().optional(),
});

/** Update incident request */
export const updateIncidentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  priority_code: priorityCodeSchema.optional(),
  status: incidentStateSchema.optional(),
  location_geom: geoJsonPointSchema.nullable().optional(),
  location_accuracy_m: z.number().nonnegative().nullable().optional(),
  summary: z.string().nullable().optional(),
  version: z.number().int().positive(), // optimistic locking
});

/** Link report to incident */
export const linkReportSchema = z.object({
  report_id: uuidSchema,
  relationship_type: relationshipTypeSchema,
  reason: z.string().optional(),
});

/** List incidents query */
export const listIncidentsQuerySchema = z.object({
  status: z.string().optional(),
  priority_code: z.string().optional(),
  category_code: z.string().optional(),
  cursor: cursorSchema,
  limit: limitSchema,
});

// ============================================
// Assignment Schemas
// ============================================

/** Create assignment request */
export const createAssignmentSchema = z.object({
  incident_id: uuidSchema,
  team_id: uuidSchema,
  instructions: z.string().optional(),
  priority_code: priorityCodeSchema.default('P3'),
});

/** Update assignment request */
export const updateAssignmentSchema = z.object({
  status: assignmentStateSchema.optional(),
  instructions: z.string().nullable().optional(),
  priority_code: priorityCodeSchema.optional(),
  version: z.number().int().positive(), // optimistic locking
});

/** List assignments query */
export const listAssignmentsQuerySchema = z.object({
  incident_id: uuidSchema.optional(),
  team_id: uuidSchema.optional(),
  status: z.string().optional(),
  cursor: cursorSchema,
  limit: limitSchema,
});

// ============================================
// Sync Schemas
// ============================================

/** Sync event payload */
export const syncEventSchema = z.object({
  event_id: uuidSchema,
  sequence: z.number().int().positive(),
  aggregate_type: z.string(),
  aggregate_id: uuidSchema,
  event_type: z.string(),
  schema_version: z.number().int().positive(),
  occurred_at_device: isoDateTimeSchema,
  payload_hash: sha256Schema,
  payload: z.record(z.unknown()),
});

/** Push events request */
export const pushEventsSchema = z.object({
  origin_node_id: uuidSchema,
  stream_name: z.string(),
  events: z.array(syncEventSchema),
});

/** Push events response */
export const pushEventsResponseSchema = z.object({
  accepted: z.number().int().nonnegative(),
  already_processed: z.number().int().nonnegative(),
  errors: z.array(
    z.object({
      event_id: uuidSchema,
      code: z.string(),
      message: z.string(),
    })
  ),
});

/** Pull changes query */
export const pullChangesQuerySchema = z.object({
  stream_name: z.string(),
  cursor: cursorSchema,
  limit: limitSchema,
});

/** Pull changes response */
export const pullChangesResponseSchema = z.object({
  events: z.array(syncEventSchema),
  cursor: z.string().nullable(),
  has_more: z.boolean(),
});

// ============================================
// Notification Schemas
// ============================================

/** Create notification request */
export const createNotificationSchema = z.object({
  recipient_user_id: uuidSchema,
  channel: notificationChannelSchema,
  template_code: z.string(),
  related_type: z.string().optional(),
  related_id: uuidSchema.optional(),
  payload: z.record(z.unknown()).optional(),
});

/** List notifications query */
export const listNotificationsQuerySchema = z.object({
  channel: z.string().optional(),
  delivery_state: z.string().optional(),
  cursor: cursorSchema,
  limit: limitSchema,
});

// ============================================
// Audit Schemas
// ============================================

/** List audit logs query */
export const listAuditLogsQuerySchema = z.object({
  action_code: z.string().optional(),
  target_type: z.string().optional(),
  target_id: uuidSchema.optional(),
  actor_user_id: uuidSchema.optional(),
  actor_organization_id: uuidSchema.optional(),
  from_date: isoDateTimeSchema.optional(),
  to_date: isoDateTimeSchema.optional(),
  cursor: cursorSchema,
  limit: limitSchema,
});

/** Export audit logs request */
export const exportAuditLogsSchema = z.object({
  action_code: z.string().optional(),
  target_type: z.string().optional(),
  target_id: uuidSchema.optional(),
  actor_user_id: uuidSchema.optional(),
  actor_organization_id: uuidSchema.optional(),
  from_date: isoDateTimeSchema,
  to_date: isoDateTimeSchema,
  format: z.enum(['csv', 'json']).default('csv'),
});

// ============================================
// Organization Schemas
// ============================================

/** Create organization request */
export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  organization_type: organizationTypeSchema,
  jurisdiction_code: z.string().max(10).optional(),
  parent_organization_id: uuidSchema.nullable().optional(),
  timezone: z.string().default('UTC'),
});

/** Update organization request */
export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  organization_type: organizationTypeSchema.optional(),
  jurisdiction_code: z.string().max(10).nullable().optional(),
  parent_organization_id: uuidSchema.nullable().optional(),
  timezone: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

// ============================================
// User Schemas
// ============================================

/** Update user profile request */
export const updateUserProfileSchema = z.object({
  display_name: z.string().max(255).optional(),
  preferred_language: z.string().max(10).optional(),
});

/** Change password request */
export const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8),
});

// ============================================
// Device Schemas
// ============================================

/** Register device request */
export const registerDeviceSchema = z.object({
  platform: devicePlatformSchema,
  app_version: z.string(),
  os_version: z.string().optional(),
  model: z.string().optional(),
  public_key: z.string().min(1), // base64 encoded public key
});

/** Device heartbeat request */
export const deviceHeartbeatSchema = z.object({
  device_id: uuidSchema,
  app_version: z.string().optional(),
  os_version: z.string().optional(),
});

// ============================================
// Error Response Schema
// ============================================

/** Standardized error response */
export const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  details: z.record(z.unknown()).optional(),
});

// ============================================
// Type Exports (inferred from schemas)
// ============================================

export type CreateSessionDto = z.infer<typeof createSessionSchema>;
export type RefreshSessionDto = z.infer<typeof refreshSessionSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type TokenResponse = z.infer<typeof tokenResponseSchema>;
export type UserPayload = z.infer<typeof userPayloadSchema>;

export type CreateReportDto = z.infer<typeof createReportSchema>;
export type UpdateReportDto = z.infer<typeof updateReportSchema>;
export type ListReportsQueryDto = z.infer<typeof listReportsQuerySchema>;
export type ReportListResponse = z.infer<typeof reportListResponseSchema>;
export type CreateReportResponse = z.infer<typeof createReportResponseSchema>;
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;

export type CreateUploadSessionDto = z.infer<typeof createUploadSessionSchema>;
export type CompleteUploadDto = z.infer<typeof completeUploadSchema>;
export type UploadSessionResponse = z.infer<typeof uploadSessionResponseSchema>;

export type CreateIncidentDto = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentDto = z.infer<typeof updateIncidentSchema>;
export type LinkReportDto = z.infer<typeof linkReportSchema>;
export type ListIncidentsQueryDto = z.infer<typeof listIncidentsQuerySchema>;

export type CreateAssignmentDto = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentDto = z.infer<typeof updateAssignmentSchema>;
export type ListAssignmentsQueryDto = z.infer<typeof listAssignmentsQuerySchema>;

export type PushEventsDto = z.infer<typeof pushEventsSchema>;
export type PushEventsResponse = z.infer<typeof pushEventsResponseSchema>;
export type PullChangesQueryDto = z.infer<typeof pullChangesQuerySchema>;
export type PullChangesResponse = z.infer<typeof pullChangesResponseSchema>;
export type SyncEvent = z.infer<typeof syncEventSchema>;

export type CreateNotificationDto = z.infer<typeof createNotificationSchema>;
export type ListNotificationsQueryDto = z.infer<typeof listNotificationsQuerySchema>;

export type ListAuditLogsQueryDto = z.infer<typeof listAuditLogsQuerySchema>;
export type ExportAuditLogsDto = z.infer<typeof exportAuditLogsSchema>;

export type CreateOrganizationDto = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationDto = z.infer<typeof updateOrganizationSchema>;

export type UpdateUserProfileDto = z.infer<typeof updateUserProfileSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

export type RegisterDeviceDto = z.infer<typeof registerDeviceSchema>;
export type DeviceHeartbeatDto = z.infer<typeof deviceHeartbeatSchema>;

export type ErrorResponse = z.infer<typeof errorResponseSchema>;