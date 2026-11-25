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

import { CreateIncidentDto, UpdateIncidentDto, LinkReportDto, ListIncidentsQueryDto } from './dto';
import { UserPayload } from '../common/interfaces/user-payload.interface';

@Injectable()
export class IncidentsService {
  constructor(@InjectConnection() private readonly knex: Knex) {}

  async createIncident(dto: CreateIncidentDto, user: UserPayload): Promise<{ incident_id: string; incident_number: string }> {
    // Verify permissions
    if (!user.permissions.includes('incident:create')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Insufficient permissions to create incident',
        retryable: false,
      });
    }

    // Validate priority_code
    const priority = await this.knex('priority_levels')
      .where('priority_code', dto.priority_code)
      .where('is_active', true)
      .first();

    if (!priority) {
      throw new BadRequestException({
        code: 'INVALID_PRIORITY',
        message: 'Invalid or inactive priority level',
        retryable: false,
      });
    }

    // Validate incident type if provided
    if (dto.incident_type_code) {
      const type = await this.knex('incident_types')
        .where('type_code', dto.incident_type_code)
        .where('is_active', true)
        .first();
      if (!type) {
        throw new BadRequestException({
          code: 'INVALID_INCIDENT_TYPE',
          message: 'Invalid incident type',
          retryable: false,
        });
      }
    }

    // Validate jurisdiction
    if (dto.jurisdiction_organization_id) {
      const org = await this.knex('organizations')
        .where('organization_id', dto.jurisdiction_organization_id)
        .first();
      if (!org) {
        throw new BadRequestException({
          code: 'INVALID_JURISDICTION',
          message: 'Invalid jurisdiction organization',
          retryable: false,
        });
      }
    }

    // Generate incident number (e.g., INC-2024-000001)
    const year = new Date().getFullYear();
    const count = await this.knex('incidents')
      .whereRaw('EXTRACT(YEAR FROM created_at) = ?', [year])
      .count('* as cnt')
      .first();
    const sequence = parseInt(String(count?.cnt || '0'), 10) + 1;
    const incident_number = `INC-${year}-${sequence.toString().padStart(6, '0')}`;

    const incident_id = uuidv4();
    const now = new Date();

    await this.knex('incidents').insert({
      incident_id,
      incident_number,
      organization_id: dto.jurisdiction_organization_id || user.memberships[0]?.organization_id,
      created_by_user_id: user.user_id,
      incident_type_code: dto.incident_type_code || null,
      priority_code: dto.priority_code,
      title: dto.title,
      description: dto.description || null,
      location_geom: dto.location_geom
        ? this.knex.raw('ST_SetSRID(ST_MakePoint(?, ?), 4326)', [
            dto.location_geom.coordinates[0],
            dto.location_geom.coordinates[1],
          ])
        : null,
      incident_status: 'new',
      version: 1,
      created_at: now,
      updated_at: now,
    });

    // Create status event
    await this.knex('status_events').insert({
      event_id: uuidv4(),
      aggregate_type: 'INCIDENT',
      aggregate_id: incident_id,
      event_type: 'INCIDENT_CREATED',
      actor_user_id: user.user_id,
      actor_role: user.roles[0] || 'unknown',
      reason: 'Incident created',
      occurred_at: now,
      schema_version: 1,
    });

    // Create outbox event
    await this.createOutboxEvent({
      aggregate_type: 'INCIDENT',
      aggregate_id: incident_id,
      event_type: 'INCIDENT_CREATED',
      payload: { incident_id, incident_number },
      schema_version: 1,
      occurred_at_device: now.toISOString(),
    });

    return { incident_id, incident_number };
  }

  async getIncident(incidentId: string, user: UserPayload): Promise<any> {
    const incident = await this.knex('incidents')
      .where('incident_id', incidentId)
      .first();

    if (!incident) {
      throw new NotFoundException({
        code: 'INCIDENT_NOT_FOUND',
        message: 'Incident not found',
        retryable: false,
      });
    }

    // Check scope
    if (!this.canAccessIncident(user, incident)) {
      throw new ForbiddenException({
        code: 'SCOPE_DENIED',
        message: 'Access denied to this incident',
        retryable: false,
      });
    }

    // Get linked reports
    const reportLinks = await this.knex('incident_reports')
      .where('incident_id', incidentId)
      .join('reports', 'incident_reports.report_id', 'reports.report_id')
      .select(
        'reports.report_id',
        'reports.category_code',
        'reports.severity_code',
        'reports.report_status',
        'incident_reports.relationship_type',
        'incident_reports.linked_by_user_id',
        'incident_reports.linked_at',
        'incident_reports.notes',
      );

    // Get assignments
    const assignments = await this.knex('assignments')
      .where('incident_id', incidentId)
      .join('response_teams', 'assignments.team_id', 'response_teams.team_id')
      .select(
        'assignments.*',
        'response_teams.name as team_name',
        'response_teams.team_type',
      )
      .orderBy('assignments.created_at', 'desc');

    // Get status events
    const statusEvents = await this.knex('status_events')
      .where('aggregate_type', 'INCIDENT')
      .where('aggregate_id', incidentId)
      .orderBy('occurred_at');

    return {
      ...incident,
      report_links: reportLinks,
      assignments,
      status_events: statusEvents,
    };
  }

  async listIncidents(query: ListIncidentsQueryDto, user: UserPayload): Promise<{
    incidents: any[];
    cursor: string | null;
    has_more: boolean;
  }> {
    let q = this.knex('incidents')
      .select(
        'incident_id',
        'incident_number',
        'organization_id',
        'created_by_user_id',
        'incident_type_code',
        'priority_code',
        'title',
        'incident_status',
        'created_at',
        'updated_at',
      );

    // Apply scope filtering
    q = this.applyScopeFilter(q, user);

    // Apply filters
    if (query.incident_status) {
      q = q.where('incident_status', query.incident_status);
    }
    if (query.priority_code) {
      q = q.where('priority_code', query.priority_code);
    }
    if (query.incident_type_code) {
      q = q.where('incident_type_code', query.incident_type_code);
    }
    if (query.organization_id) {
      q = q.where('organization_id', query.organization_id);
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
      if (cursorData.incident_id) {
        q = q.where(function () {
          this.where('created_at', '<', new Date(cursorData.created_at))
            .orWhere(function () {
              this.where('created_at', '=', new Date(cursorData.created_at))
                .andWhere('incident_id', '<', cursorData.incident_id);
            });
        });
      }
    }

    const limit = Math.min(query.limit || 50, 200);
    q = q.orderBy('created_at', 'desc').orderBy('incident_id', 'desc').limit(limit + 1);

    const incidents = await q;

    let nextCursor: string | null = null;
    if (incidents.length > limit) {
      const last = incidents[limit - 1];
      nextCursor = this.encodeCursor({ created_at: last.created_at, incident_id: last.incident_id });
      incidents.pop();
    }

    return {
      incidents,
      cursor: nextCursor,
      has_more: !!nextCursor,
    };
  }

  async updateIncident(incidentId: string, dto: UpdateIncidentDto, user: UserPayload): Promise<void> {
    const incident = await this.knex('incidents')
      .where('incident_id', incidentId)
      .first();

    if (!incident) {
      throw new NotFoundException({
        code: 'INCIDENT_NOT_FOUND',
        message: 'Incident not found',
        retryable: false,
      });
    }

    // Check scope and permissions
    if (!this.canManageIncident(user, incident)) {
      throw new ForbiddenException({
        code: 'SCOPE_DENIED',
        message: 'Insufficient permissions to update this incident',
        retryable: false,
      });
    }

    // Version check
    if (dto.expected_version !== undefined) {
      if (incident.version !== dto.expected_version) {
        throw new ConflictException({
          code: 'VERSION_CONFLICT',
          message: 'Incident has been modified by another process',
          retryable: false,
        });
      }
    }

    // Validate status transition
    if (dto.incident_status && dto.incident_status !== incident.incident_status) {
      this.validateStatusTransition(incident.incident_status, dto.incident_status);
    }

    const updates: any = { updated_at: new Date(), version: incident.version + 1 };

    if (dto.incident_status) updates.incident_status = dto.incident_status;
    if (dto.priority_code) updates.priority_code = dto.priority_code;
    if (dto.title) updates.title = dto.title;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.location_geom) {
      updates.location_geom = this.knex.raw('ST_SetSRID(ST_MakePoint(?, ?), 4326)', [
        dto.location_geom.coordinates[0],
        dto.location_geom.coordinates[1],
      ]);
    }

    await this.knex('incidents').where('incident_id', incidentId).update(updates);

    // Create status event if status changed
    if (dto.incident_status && dto.incident_status !== incident.incident_status) {
      await this.knex('status_events').insert({
        event_id: uuidv4(),
        aggregate_type: 'INCIDENT',
        aggregate_id: incidentId,
        event_type: `INCIDENT_${dto.incident_status.toUpperCase()}`,
        actor_user_id: user.user_id,
        actor_role: user.roles[0] || 'unknown',
        reason: dto.reason || `Status changed to ${dto.incident_status}`,
        occurred_at: new Date(),
        schema_version: 1,
      });
    }

    // Create outbox event
    await this.createOutboxEvent({
      aggregate_type: 'INCIDENT',
      aggregate_id: incidentId,
      event_type: 'INCIDENT_UPDATED',
      payload: { incident_id: incidentId, changes: updates },
      schema_version: 1,
      occurred_at_device: new Date().toISOString(),
    });
  }

  async linkReport(incidentId: string, dto: LinkReportDto, user: UserPayload): Promise<void> {
    const incident = await this.knex('incidents')
      .where('incident_id', incidentId)
      .first();

    if (!incident) {
      throw new NotFoundException({
        code: 'INCIDENT_NOT_FOUND',
        message: 'Incident not found',
        retryable: false,
      });
    }

    // Check permissions
    if (!this.canManageIncident(user, incident)) {
      throw new ForbiddenException({
        code: 'SCOPE_DENIED',
        message: 'Insufficient permissions to link reports',
        retryable: false,
      });
    }

    const report = await this.knex('reports')
      .where('report_id', dto.report_id)
      .first();

    if (!report) {
      throw new NotFoundException({
        code: 'REPORT_NOT_FOUND',
        message: 'Report not found',
        retryable: false,
      });
    }

    // Check if already linked
    const existing = await this.knex('incident_reports')
      .where('incident_id', incidentId)
      .where('report_id', dto.report_id)
      .first();

    if (existing) {
      throw new ConflictException({
        code: 'ALREADY_LINKED',
        message: 'Report already linked to this incident',
        retryable: false,
      });
    }

    await this.knex('incident_reports').insert({
      incident_id: incidentId,
      report_id: dto.report_id,
      relationship_type: dto.relationship_type,
      linked_by_user_id: user.user_id,
      notes: dto.notes || null,
    });

    // Create status event
    await this.knex('status_events').insert({
      event_id: uuidv4(),
      aggregate_type: 'INCIDENT',
      aggregate_id: incidentId,
      event_type: 'REPORT_LINKED',
      actor_user_id: user.user_id,
      actor_role: user.roles[0] || 'unknown',
      reason: `Report ${dto.report_id} linked as ${dto.relationship_type}`,
      metadata_json: { report_id: dto.report_id, relationship_type: dto.relationship_type },
      occurred_at: new Date(),
      schema_version: 1,
    });

    // Create outbox event
    await this.createOutboxEvent({
      aggregate_type: 'INCIDENT',
      aggregate_id: incidentId,
      event_type: 'REPORT_LINKED',
      payload: { incident_id: incidentId, report_id: dto.report_id, relationship_type: dto.relationship_type },
      schema_version: 1,
      occurred_at_device: new Date().toISOString(),
    });
  }

  async unlinkReport(incidentId: string, reportId: string, user: UserPayload): Promise<void> {
    const incident = await this.knex('incidents')
      .where('incident_id', incidentId)
      .first();

    if (!incident) {
      throw new NotFoundException({
        code: 'INCIDENT_NOT_FOUND',
        message: 'Incident not found',
        retryable: false,
      });
    }

    if (!this.canManageIncident(user, incident)) {
      throw new ForbiddenException({
        code: 'SCOPE_DENIED',
        message: 'Insufficient permissions to unlink reports',
        retryable: false,
      });
    }

    const link = await this.knex('incident_reports')
      .where('incident_id', incidentId)
      .where('report_id', reportId)
      .first();

    if (!link) {
      throw new NotFoundException({
        code: 'LINK_NOT_FOUND',
        message: 'Report not linked to this incident',
        retryable: false,
      });
    }

    await this.knex('incident_reports')
      .where('incident_id', incidentId)
      .where('report_id', reportId)
      .delete();

    // Create status event
    await this.knex('status_events').insert({
      event_id: uuidv4(),
      aggregate_type: 'INCIDENT',
      aggregate_id: incidentId,
      event_type: 'REPORT_UNLINKED',
      actor_user_id: user.user_id,
      actor_role: user.roles[0] || 'unknown',
      reason: `Report ${reportId} unlinked`,
      metadata_json: { report_id: reportId },
      occurred_at: new Date(),
      schema_version: 1,
    });
  }

  private canAccessIncident(user: UserPayload, incident: any): boolean {
    // Creator can access
    if (incident.created_by_user_id === user.user_id) return true;

    // Org admin can access org incidents
    if (user.roles.includes('org_admin')) {
      return user.memberships.some(
        (m) => m.organization_id === incident.organization_id && m.status === 'active',
      );
    }

    // Operator/verifier/team_lead can access if in scope
    if (user.permissions.includes('incident:read:scope')) {
      return user.memberships.some(
        (m) => m.organization_id === incident.organization_id && m.status === 'active',
      );
    }

    // Team lead can access if assigned
    const assignment = user.permissions.includes('assignment:read:own');
    // Check if user has assignment to this incident

    return false;
  }

  private canManageIncident(user: UserPayload, incident: any): boolean {
    // Org admin can manage
    if (user.roles.includes('org_admin')) {
      return user.memberships.some(
        (m) => m.organization_id === incident.organization_id && m.status === 'active',
      );
    }

    // Verifier can manage
    if (user.permissions.includes('incident:create')) {
      return user.memberships.some(
        (m) => m.organization_id === incident.organization_id && m.status === 'active',
      );
    }

    return false;
  }

  private validateStatusTransition(from: string, to: string): void {
    const validTransitions: Record<string, string[]> = {
      new: ['triaged', 'rejected'],
      triaged: ['verified', 'new'],
      verified: ['assigned', 'triaged'],
      assigned: ['dispatched', 'verified'],
      dispatched: ['response_in_progress', 'assigned'],
      response_in_progress: ['resolved', 'dispatched'],
      resolved: ['closed', 'response_in_progress'],
      closed: [],
      rejected: ['new'],
    };

    const allowed = validTransitions[from] || [];
    if (!allowed.includes(to)) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Invalid status transition from ${from} to ${to}`,
        retryable: false,
      });
    }
  }

  private applyScopeFilter(query: Knex.QueryBuilder, user: UserPayload): Knex.QueryBuilder {
    if (user.roles.includes('org_admin') || user.permissions.includes('incident:read:scope')) {
      const orgIds = user.memberships
        .filter((m) => m.status === 'active')
        .map((m) => m.organization_id);
      return query.whereIn('organization_id', orgIds);
    }

    // Creator sees own
    return query.where('created_by_user_id', user.user_id);
  }

  private async createOutboxEvent(event: {
    aggregate_type: string;
    aggregate_id: string;
    event_type: string;
    payload: any;
    schema_version: number;
    occurred_at_device: string;
  }): Promise<void> {
    const crypto = require('crypto');
    const payloadStr = JSON.stringify(event.payload);
    const payloadHash = crypto.createHash('sha256').update(payloadStr).digest('hex');

    await this.knex('sync_outbox').insert({
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

  private encodeCursor(data: { created_at: Date; incident_id: string }): string {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  private decodeCursor(cursor: string): { created_at: Date; incident_id: string } {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString());
    } catch {
      return { created_at: new Date(), incident_id: '' };
    }
  }
}