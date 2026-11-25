import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Knex } from 'knex';
import { InjectConnection } from 'nestjs-knex';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

import { CreateReportDto, UpdateReportDto, ListReportsQueryDto } from './dto';
import { UserPayload } from '../common/interfaces/user-payload.interface';

@Injectable()
export class ReportsService {
  constructor(@InjectConnection() private readonly knex: Knex) {}

  async createReport(dto: CreateReportDto, user: UserPayload): Promise<{
    report_id: string;
    status: string;
    evidence: Array<{ evidence_id: string; storage_state: string }>;
  }> {
    // Validate report_id is a valid UUID v4
    if (!this.isValidUUIDv4(dto.report_id)) {
      throw new BadRequestException({
        code: 'INVALID_REPORT_ID',
        message: 'report_id must be a valid UUID v4',
        retryable: false,
      });
    }

    // Validate idempotency key if provided
    if (dto.idempotency_key) {
      const existing = await this.checkIdempotency(dto.idempotency_key, user.user_id);
      if (existing) {
        return existing;
      }
    }

    // Validate category and severity exist
    await this.validateReferenceData(dto);

    // Validate user has permission to create report
    if (!user.permissions.includes('report:create')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Insufficient permissions to create report',
        retryable: false,
      });
    }

    // Determine organization_id from user's memberships
    const organizationId = dto.organization_id || user.memberships[0]?.organization_id;
    if (!organizationId) {
      throw new BadRequestException({
        code: 'NO_ORGANIZATION',
        message: 'User must belong to an organization',
        retryable: false,
      });
    }

    // Verify user is member of the organization
    const membership = user.memberships.find(
      (m) => m.organization_id === organizationId && m.status === 'active',
    );
    if (!membership) {
      throw new ForbiddenException({
        code: 'SCOPE_DENIED',
        message: 'Not a member of the specified organization',
        retryable: false,
      });
    }

    // Start transaction
    return this.knex.transaction(async (trx) => {
      // Check for duplicate report_id (idempotency)
      const existingReport = await trx('reports')
        .where('report_id', dto.report_id)
        .first();

      if (existingReport) {
        // Check if payload matches (hash comparison)
        const existingHash = this.calculatePayloadHash(dto, user.user_id, organizationId);
        if (existingReport.payload_hash === existingHash) {
          // Same payload - return existing
          const evidence = await trx('evidence')
            .where('report_id', dto.report_id)
            .select('evidence_id', 'storage_state');
          return {
            report_id: dto.report_id,
            status: existingReport.report_status,
            evidence,
          };
        } else {
          // Different payload - conflict
          throw new ConflictException({
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'Report ID already exists with different payload',
            retryable: false,
          });
        }
      }

      // Insert report
      const payloadHash = this.calculatePayloadHash(dto, user.user_id, organizationId);
      const now = new Date();

      await trx('reports').insert({
        report_id: dto.report_id,
        organization_id: organizationId,
        reporter_user_id: user.user_id,
        reporter_device_id: user.device_id || null,
        category_code: dto.category_code,
        severity_code: dto.severity_code,
        impact_json: dto.impact_json || {},
        location_geom: dto.location_geom
          ? this.knex.raw('ST_SetSRID(ST_MakePoint(?, ?), 4326)', [
              dto.location_geom.coordinates[0],
              dto.location_geom.coordinates[1],
            ])
          : null,
        location_accuracy_m: dto.location_accuracy_m || null,
        location_source: dto.location_source || 'gps',
        capture_started_at: dto.capture_started_at ? new Date(dto.capture_started_at) : now,
        capture_completed_at: dto.capture_completed_at ? new Date(dto.capture_completed_at) : now,
        device_timezone: dto.device_timezone || 'UTC',
        device_os: dto.device_os || null,
        app_version: dto.app_version || null,
        report_status: 'submitted',
        payload_hash: payloadHash,
        created_at: now,
        updated_at: now,
      });

      // Insert evidence records
      const evidenceRecords = dto.evidence.map((e) => ({
        evidence_id: e.evidence_id,
        report_id: dto.report_id,
        kind: e.kind,
        mime_type: e.mime_type,
        size_bytes: e.size_bytes,
        sha256_hash: e.sha256_hash,
        capture_metadata_json: e.capture_metadata_json || {},
        storage_state: 'UPLOAD_REQUIRED',
        integrity_status: 'pending',
        created_at: now,
        updated_at: now,
      }));

      if (evidenceRecords.length > 0) {
        await trx('evidence').insert(evidenceRecords);
      }

      // Create outbox event for sync
      await this.createOutboxEvent(trx, {
        aggregate_type: 'REPORT',
        aggregate_id: dto.report_id,
        event_type: 'REPORT_SUBMITTED',
        payload: {
          report_id: dto.report_id,
          organization_id: organizationId,
          reporter_user_id: user.user_id,
          category_code: dto.category_code,
          severity_code: dto.severity_code,
        },
        schema_version: 1,
        occurred_at_device: dto.capture_completed_at || now.toISOString(),
      });

      // Store idempotency key if provided
      if (dto.idempotency_key) {
        await this.storeIdempotencyKey(trx, dto.idempotency_key, user.user_id, dto.report_id);
      }

      return {
        report_id: dto.report_id,
        status: 'submitted',
        evidence: evidenceRecords.map((e) => ({
          evidence_id: e.evidence_id,
          storage_state: e.storage_state,
        })),
      };
    });
  }

  async getReport(reportId: string, user: UserPayload): Promise<any> {
    const report = await this.knex('reports')
      .where('report_id', reportId)
      .first();

    if (!report) {
      throw new NotFoundException({
        code: 'REPORT_NOT_FOUND',
        message: 'Report not found',
        retryable: false,
      });
    }

    // Check scope
    if (!this.canAccessReport(user, report)) {
      throw new ForbiddenException({
        code: 'SCOPE_DENIED',
        message: 'Access denied to this report',
        retryable: false,
      });
    }

    // Get evidence
    const evidence = await this.knex('evidence')
      .where('report_id', reportId)
      .orderBy('created_at');

    // Get linked incidents
    const incidentLinks = await this.knex('incident_reports')
      .where('report_id', reportId)
      .join('incidents', 'incident_reports.incident_id', 'incidents.incident_id')
      .select('incidents.incident_id', 'incidents.incident_number', 'incident_reports.relationship_type');

    // Get status events
    const statusEvents = await this.knex('status_events')
      .where('aggregate_type', 'REPORT')
      .where('aggregate_id', reportId)
      .orderBy('occurred_at');

    return {
      ...report,
      evidence,
      incident_links: incidentLinks,
      status_events: statusEvents,
    };
  }

  async listReports(query: ListReportsQueryDto, user: UserPayload): Promise<{
    reports: any[];
    cursor: string | null;
    has_more: boolean;
  }> {
    let q = this.knex('reports')
      .select(
        'report_id',
        'organization_id',
        'reporter_user_id',
        'category_code',
        'severity_code',
        'report_status',
        'created_at',
        'updated_at',
      );

    // Apply scope filtering
    q = this.applyScopeFilter(q, user);

    // Apply filters
    if (query.category_code) {
      q = q.where('category_code', query.category_code);
    }
    if (query.severity_code) {
      q = q.where('severity_code', query.severity_code);
    }
    if (query.report_status) {
      q = q.where('report_status', query.report_status);
    }
    if (query.organization_id) {
      q = q.where('organization_id', query.organization_id);
    }
    if (query.reporter_user_id) {
      q = q.where('reporter_user_id', query.reporter_user_id);
    }
    if (query.from_date) {
      q = q.where('created_at', '>=', new Date(query.from_date));
    }
    if (query.to_date) {
      q = q.where('created_at', '<=', new Date(query.to_date));
    }
    if (query.bbox) {
      const [minLon, minLat, maxLon, maxLat] = query.bbox.split(',').map(Number);
      q = q.whereRaw(
        'ST_Intersects(location_geom, ST_MakeEnvelope(?, ?, ?, ?, 4326))',
        [minLon, minLat, maxLon, maxLat],
      );
    }

    // Cursor-based pagination
    if (query.cursor) {
      const cursorData = this.decodeCursor(query.cursor);
      q = q.where('created_at', '<', new Date(cursorData.created_at));
      if (cursorData.report_id) {
        q = q.where(function () {
          this.where('created_at', '<', new Date(cursorData.created_at))
            .orWhere(function () {
              this.where('created_at', '=', new Date(cursorData.created_at))
                .andWhere('report_id', '<', cursorData.report_id);
            });
        });
      }
    }

    // Order and limit
    const limit = Math.min(query.limit || 50, 200);
    q = q.orderBy('created_at', 'desc').orderBy('report_id', 'desc').limit(limit + 1);

    const reports = await q;

    let nextCursor: string | null = null;
    if (reports.length > limit) {
      const last = reports[limit - 1];
      nextCursor = this.encodeCursor({ created_at: last.created_at, report_id: last.report_id });
      reports.pop();
    }

    return {
      reports,
      cursor: nextCursor,
      has_more: !!nextCursor,
    };
  }

  async updateReport(reportId: string, dto: UpdateReportDto, user: UserPayload): Promise<void> {
    const report = await this.knex('reports')
      .where('report_id', reportId)
      .first();

    if (!report) {
      throw new NotFoundException({
        code: 'REPORT_NOT_FOUND',
        message: 'Report not found',
        retryable: false,
      });
    }

    // Check scope - only reporter or org_admin can update
    if (report.reporter_user_id !== user.user_id && !user.roles.includes('org_admin')) {
      throw new ForbiddenException({
        code: 'SCOPE_DENIED',
        message: 'Only the reporter or org_admin can update this report',
        retryable: false,
      });
    }

    // Version check
    if (dto.expected_version !== undefined) {
      if (report.version !== dto.expected_version) {
        throw new ConflictException({
          code: 'VERSION_CONFLICT',
          message: 'Report has been modified by another process',
          retryable: false,
        });
      }
    }

    const updates: any = { updated_at: new Date() };

    if (dto.impact_json) updates.impact_json = dto.impact_json;
    if (dto.location_geom) {
      updates.location_geom = this.knex.raw('ST_SetSRID(ST_MakePoint(?, ?), 4326)', [
        dto.location_geom.coordinates[0],
        dto.location_geom.coordinates[1],
      ]);
    }
    if (dto.location_accuracy_m !== undefined) updates.location_accuracy_m = dto.location_accuracy_m;

    await this.knex('reports').where('report_id', reportId).update(updates);

    // Create outbox event
    await this.createOutboxEvent(this.knex, {
      aggregate_type: 'REPORT',
      aggregate_id: reportId,
      event_type: 'REPORT_AMENDED',
      payload: { report_id: reportId, changes: updates },
      schema_version: 1,
      occurred_at_device: new Date().toISOString(),
    });
  }

  async acknowledgeReport(reportId: string, user: UserPayload): Promise<void> {
    if (!user.permissions.includes('report:acknowledge')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Insufficient permissions to acknowledge report',
        retryable: false,
      });
    }

    const report = await this.knex('reports')
      .where('report_id', reportId)
      .first();

    if (!report) {
      throw new NotFoundException({
        code: 'REPORT_NOT_FOUND',
        message: 'Report not found',
        retryable: false,
      });
    }

    // Check scope
    if (!this.canAccessReport(user, report)) {
      throw new ForbiddenException({
        code: 'SCOPE_DENIED',
        message: 'Access denied to this report',
        retryable: false,
      });
    }

    // Update report status
    await this.knex('reports')
      .where('report_id', reportId)
      .update({
        report_status: 'acknowledged',
        updated_at: new Date(),
      });

    // Create status event
    await this.knex('status_events').insert({
      event_id: uuidv4(),
      aggregate_type: 'REPORT',
      aggregate_id: reportId,
      event_type: 'REPORT_ACKNOWLEDGED',
      actor_user_id: user.user_id,
      actor_role: user.roles[0] || 'unknown',
      reason: 'Acknowledged by operator',
      occurred_at: new Date(),
      schema_version: 1,
    });

    // Create outbox event
    await this.createOutboxEvent(this.knex, {
      aggregate_type: 'REPORT',
      aggregate_id: reportId,
      event_type: 'REPORT_ACKNOWLEDGED',
      payload: { report_id: reportId, acknowledged_by: user.user_id },
      schema_version: 1,
      occurred_at_device: new Date().toISOString(),
    });
  }

  private async validateReferenceData(dto: CreateReportDto): Promise<void> {
    const category = await this.knex('report_categories')
      .where('category_code', dto.category_code)
      .where('is_active', true)
      .first();

    if (!category) {
      throw new BadRequestException({
        code: 'INVALID_CATEGORY',
        message: 'Invalid or inactive category',
        retryable: false,
      });
    }

    const severity = await this.knex('severity_levels')
      .where('severity_code', dto.severity_code)
      .where('is_active', true)
      .first();

    if (!severity) {
      throw new BadRequestException({
        code: 'INVALID_SEVERITY',
        message: 'Invalid or inactive severity level',
        retryable: false,
      });
    }

    // Validate evidence if provided
    for (const evidence of dto.evidence) {
      if (!this.isValidUUIDv4(evidence.evidence_id)) {
        throw new BadRequestException({
          code: 'INVALID_EVIDENCE_ID',
          message: 'evidence_id must be a valid UUID v4',
          retryable: false,
        });
      }

      const kind = await this.knex('evidence_kinds')
        .where('kind_code', evidence.kind)
        .where('is_active', true)
        .first();

      if (!kind) {
        throw new BadRequestException({
          code: 'INVALID_EVIDENCE_KIND',
          message: `Invalid evidence kind: ${evidence.kind}`,
          retryable: false,
        });
      }
    }
  }

  private canAccessReport(user: UserPayload, report: any): boolean {
    // Reporter can always access
    if (report.reporter_user_id === user.user_id) return true;

    // Org admin can access org reports
    if (user.roles.includes('org_admin')) {
      return user.memberships.some(
        (m) => m.organization_id === report.organization_id && m.status === 'active',
      );
    }

    // Operator/verifier can access if in scope
    if (user.permissions.includes('report:read:scope')) {
      return user.memberships.some(
        (m) => m.organization_id === report.organization_id && m.status === 'active',
      );
    }

    return false;
  }

  private applyScopeFilter(query: Knex.QueryBuilder, user: UserPayload): Knex.QueryBuilder {
    if (user.roles.includes('org_admin')) {
      // Org admin sees all reports in their organizations
      const orgIds = user.memberships
        .filter((m) => m.status === 'active')
        .map((m) => m.organization_id);
      return query.whereIn('organization_id', orgIds);
    }

    if (user.permissions.includes('report:read:scope')) {
      // Scoped access
      const orgIds = user.memberships
        .filter((m) => m.status === 'active')
        .map((m) => m.organization_id);
      return query.whereIn('organization_id', orgIds);
    }

    // Reporter sees only own
    return query.where('reporter_user_id', user.user_id);
  }

  private isValidUUIDv4(uuid: string): boolean {
    const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidv4Regex.test(uuid);
  }

  private calculatePayloadHash(dto: CreateReportDto, userId: string, organizationId: string): string {
    const payload = JSON.stringify({
      ...dto,
      reporter_user_id: userId,
      organization_id: organizationId,
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  private async checkIdempotency(
    idempotencyKey: string,
    userId: string,
  ): Promise<{ report_id: string; status: string; evidence: any[] } | null> {
    const record = await this.knex('idempotency_keys')
      .where('idempotency_key', idempotencyKey)
      .where('user_id', userId)
      .first();

    if (!record) return null;

    const report = await this.knex('reports')
      .where('report_id', record.report_id)
      .first();

    if (!report) return null;

    const evidence = await this.knex('evidence')
      .where('report_id', record.report_id)
      .select('evidence_id', 'storage_state');

    return {
      report_id: record.report_id,
      status: report.report_status,
      evidence,
    };
  }

  private async storeIdempotencyKey(
    trx: Knex.Transaction,
    idempotencyKey: string,
    userId: string,
    reportId: string,
  ): Promise<void> {
    await trx('idempotency_keys').insert({
      idempotency_key: idempotencyKey,
      user_id: userId,
      report_id: reportId,
      created_at: new Date(),
    });
  }

  private async createOutboxEvent(
    trx: Knex.Transaction | Knex,
    event: {
      aggregate_type: string;
      aggregate_id: string;
      event_type: string;
      payload: any;
      schema_version: number;
      occurred_at_device: string;
    },
  ): Promise<void> {
    const payloadStr = JSON.stringify(event.payload);
    const payloadHash = crypto.createHash('sha256').update(payloadStr).digest('hex');

    await trx('sync_outbox').insert({
      event_id: uuidv4(),
      origin_node_id: process.env.NODE_ID || 'central',
      stream_name: event.aggregate_type.toLowerCase() + 's',
      aggregate_type: event.aggregate_type,
      aggregate_id: event.aggregate_id,
      event_type: event.event_type,
      schema_version: event.schema_version,
      occurred_at_device: new Date(event.occurred_at_device),
      payload_hash: payloadHash,
      payload: event.payload,
      created_at: new Date(),
    });
  }

  private encodeCursor(data: { created_at: Date; report_id: string }): string {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  private decodeCursor(cursor: string): { created_at: Date; report_id: string } {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString());
    } catch {
      return { created_at: new Date(), report_id: '' };
    }
  }
}