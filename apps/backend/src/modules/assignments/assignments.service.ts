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

import { CreateAssignmentDto, UpdateAssignmentDto, ListAssignmentsQueryDto } from './dto';
import { UserPayload } from '../common/interfaces/user-payload.interface';

@Injectable()
export class AssignmentsService {
  constructor(@InjectConnection() private readonly knex: Knex) {}

  async createAssignment(dto: CreateAssignmentDto, user: UserPayload): Promise<{ assignment_id: string }> {
    // Verify permissions - team_lead or org_admin
    if (!user.permissions.includes('assignment:read:own') && !user.roles.includes('org_admin')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Insufficient permissions to create assignment',
        retryable: false,
      });
    }

    // Verify incident exists and user can access it
    const incident = await this.knex('incidents')
      .where('incident_id', dto.incident_id)
      .first();

    if (!incident) {
      throw new NotFoundException({
        code: 'INCIDENT_NOT_FOUND',
        message: 'Incident not found',
        retryable: false,
      });
    }

    // Verify team exists and is active
    const team = await this.knex('response_teams')
      .where('team_id', dto.team_id)
      .where('team_status', 'active')
      .first();

    if (!team) {
      throw new NotFoundException({
        code: 'TEAM_NOT_FOUND',
        message: 'Response team not found or inactive',
        retryable: false,
      });
    }

    // Check for existing active assignment for this team/incident
    const existing = await this.knex('assignments')
      .where('incident_id', dto.incident_id)
      .where('team_id', dto.team_id)
      .whereIn('assignment_status', ['assigned', 'acknowledged', 'en_route', 'on_scene', 'working'])
      .first();

    if (existing) {
      throw new ConflictException({
        code: 'ASSIGNMENT_EXISTS',
        message: 'Team already has an active assignment for this incident',
        retryable: false,
      });
    }

    const assignment_id = uuidv4();
    const now = new Date();

    await this.knex('assignments').insert({
      assignment_id,
      incident_id: dto.incident_id,
      team_id: dto.team_id,
      assigned_by_user_id: user.user_id,
      role_on_incident: dto.role_on_incident || 'responder',
      assignment_status: 'assigned',
      instructions: dto.instructions || null,
      assigned_at: now,
      created_at: now,
      updated_at: now,
    });

    // Create status event
    await this.knex('status_events').insert({
      event_id: uuidv4(),
      aggregate_type: 'ASSIGNMENT',
      aggregate_id: assignment_id,
      event_type: 'ASSIGNMENT_CREATED',
      actor_user_id: user.user_id,
      actor_role: user.roles[0] || 'unknown',
      reason: `Team ${team.name} assigned to incident`,
      metadata_json: { incident_id: dto.incident_id, team_id: dto.team_id, role_on_incident: dto.role_on_incident },
      occurred_at: now,
      schema_version: 1,
    });

    // Create outbox event
    await this.createOutboxEvent({
      aggregate_type: 'ASSIGNMENT',
      aggregate_id: assignment_id,
      event_type: 'ASSIGNMENT_CREATED',
      payload: { assignment_id, incident_id: dto.incident_id, team_id: dto.team_id },
      schema_version: 1,
      occurred_at_device: now.toISOString(),
    });

    return { assignment_id };
  }

  async getAssignment(assignmentId: string, user: UserPayload): Promise<any> {
    const assignment = await this.knex('assignments')
      .where('assignment_id', assignmentId)
      .join('incidents', 'assignments.incident_id', 'incidents.incident_id')
      .join('response_teams', 'assignments.team_id', 'response_teams.team_id')
      .select(
        'assignments.*',
        'incidents.incident_number',
        'incidents.title as incident_title',
        'incidents.incident_status',
        'response_teams.name as team_name',
        'response_teams.team_type',
        'response_teams.organization_id as team_org_id',
      )
      .first();

    if (!assignment) {
      throw new NotFoundException({
        code: 'ASSIGNMENT_NOT_FOUND',
        message: 'Assignment not found',
        retryable: false,
      });
    }

    // Check scope
    if (!this.canAccessAssignment(user, assignment)) {
      throw new ForbiddenException({
        code: 'SCOPE_DENIED',
        message: 'Access denied to this assignment',
        retryable: false,
      });
    }

    // Get status events
    const statusEvents = await this.knex('status_events')
      .where('aggregate_type', 'ASSIGNMENT')
      .where('aggregate_id', assignmentId)
      .orderBy('occurred_at');

    return { ...assignment, status_events: statusEvents };
  }

  async listAssignments(query: ListAssignmentsQueryDto, user: UserPayload): Promise<{
    assignments: any[];
    cursor: string | null;
    has_more: boolean;
  }> {
    let q = this.knex('assignments')
      .join('incidents', 'assignments.incident_id', 'incidents.incident_id')
      .join('response_teams', 'assignments.team_id', 'response_teams.team_id')
      .select(
        'assignments.assignment_id',
        'assignments.incident_id',
        'assignments.team_id',
        'assignments.assignment_status',
        'assignments.role_on_incident',
        'assignments.assigned_at',
        'assignments.acknowledged_at',
        'assignments.en_route_at',
        'assignments.on_scene_at',
        'assignments.completed_at',
        'incidents.incident_number',
        'incidents.title as incident_title',
        'incidents.incident_status',
        'response_teams.name as team_name',
        'response_teams.team_type',
      );

    // Apply scope filtering
    q = this.applyScopeFilter(q, user);

    // Apply filters
    if (query.assignment_status) {
      q = q.where('assignments.assignment_status', query.assignment_status);
    }
    if (query.incident_id) {
      q = q.where('assignments.incident_id', query.incident_id);
    }
    if (query.team_id) {
      q = q.where('assignments.team_id', query.team_id);
    }
    if (query.from_date) {
      q = q.where('assignments.assigned_at', '>=', new Date(query.from_date));
    }
    if (query.to_date) {
      q = q.where('assignments.assigned_at', '<=', new Date(query.to_date));
    }

    // Cursor-based pagination
    if (query.cursor) {
      const cursorData = this.decodeCursor(query.cursor);
      q = q.where('assignments.assigned_at', '<', new Date(cursorData.assigned_at));
      if (cursorData.assignment_id) {
        q = q.where(function () {
          this.where('assignments.assigned_at', '<', new Date(cursorData.assigned_at))
            .orWhere(function () {
              this.where('assignments.assigned_at', '=', new Date(cursorData.assigned_at))
                .andWhere('assignments.assignment_id', '<', cursorData.assignment_id);
            });
        });
      }
    }

    const limit = Math.min(query.limit || 50, 200);
    q = q.orderBy('assignments.assigned_at', 'desc').orderBy('assignments.assignment_id', 'desc').limit(limit + 1);

    const assignments = await q;

    let nextCursor: string | null = null;
    if (assignments.length > limit) {
      const last = assignments[limit - 1];
      nextCursor = this.encodeCursor({ assigned_at: last.assigned_at, assignment_id: last.assignment_id });
      assignments.pop();
    }

    return {
      assignments,
      cursor: nextCursor,
      has_more: !!nextCursor,
    };
  }

  async updateAssignment(assignmentId: string, dto: UpdateAssignmentDto, user: UserPayload): Promise<void> {
    const assignment = await this.knex('assignments')
      .where('assignment_id', assignmentId)
      .join('incidents', 'assignments.incident_id', 'incidents.incident_id')
      .join('response_teams', 'assignments.team_id', 'response_teams.team_id')
      .select(
        'assignments.*',
        'incidents.incident_status',
        'response_teams.organization_id as team_org_id',
      )
      .first();

    if (!assignment) {
      throw new NotFoundException({
        code: 'ASSIGNMENT_NOT_FOUND',
        message: 'Assignment not found',
        retryable: false,
      });
    }

    // Check permissions - team_lead of the team or org_admin
    const isTeamLead = user.permissions.includes('assignment:update:own') &&
      user.memberships.some(m => m.organization_id === assignment.team_org_id && m.role_code === 'team_lead');
    const isOrgAdmin = user.roles.includes('org_admin') &&
      user.memberships.some(m => m.organization_id === assignment.team_org_id);

    if (!isTeamLead && !isOrgAdmin) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Insufficient permissions to update this assignment',
        retryable: false,
      });
    }

    // Validate status transition
    if (dto.assignment_status && dto.assignment_status !== assignment.assignment_status) {
      this.validateStatusTransition(assignment.assignment_status, dto.assignment_status);
    }

    const updates: any = { updated_at: new Date() };
    const now = new Date();

    if (dto.assignment_status) {
      updates.assignment_status = dto.assignment_status;

      // Set timestamp fields based on status
      switch (dto.assignment_status) {
        case 'acknowledged':
          updates.acknowledged_at = now;
          break;
        case 'en_route':
          updates.en_route_at = now;
          break;
        case 'on_scene':
          updates.on_scene_at = now;
          break;
        case 'working':
          // working state, no specific timestamp
          break;
        case 'completed':
          updates.completed_at = now;
          break;
      }
    }

    if (dto.role_on_incident) updates.role_on_incident = dto.role_on_incident;
    if (dto.instructions !== undefined) updates.instructions = dto.instructions;
    if (dto.notes !== undefined) updates.notes = dto.notes;

    await this.knex('assignments').where('assignment_id', assignmentId).update(updates);

    // Create status event if status changed
    if (dto.assignment_status && dto.assignment_status !== assignment.assignment_status) {
      await this.knex('status_events').insert({
        event_id: uuidv4(),
        aggregate_type: 'ASSIGNMENT',
        aggregate_id: assignmentId,
        event_type: `ASSIGNMENT_${dto.assignment_status.toUpperCase()}`,
        actor_user_id: user.user_id,
        actor_role: user.roles[0] || 'unknown',
        reason: dto.reason || `Assignment status changed to ${dto.assignment_status}`,
        occurred_at: now,
        schema_version: 1,
      });
    }

    // Create outbox event
    await this.createOutboxEvent({
      aggregate_type: 'ASSIGNMENT',
      aggregate_id: assignmentId,
      event_type: 'ASSIGNMENT_UPDATED',
      payload: { assignment_id: assignmentId, changes: updates },
      schema_version: 1,
      occurred_at_device: now.toISOString(),
    });
  }

  private canAccessAssignment(user: UserPayload, assignment: any): boolean {
    // Team lead of the team can access
    if (user.permissions.includes('assignment:read:own')) {
      if (user.memberships.some(m => m.organization_id === assignment.team_org_id && m.role_code === 'team_lead')) {
        return true;
      }
    }

    // Org admin of team's organization
    if (user.roles.includes('org_admin')) {
      if (user.memberships.some(m => m.organization_id === assignment.team_org_id && m.status === 'active')) {
        return true;
      }
    }

    // Incident creator or verifier
    if (user.permissions.includes('incident:read:scope')) {
      if (user.memberships.some(m => m.organization_id === assignment.team_org_id && m.status === 'active')) {
        return true;
      }
    }

    return false;
  }

  private validateStatusTransition(from: string, to: string): void {
    const validTransitions: Record<string, string[]> = {
      assigned: ['acknowledged', 'cancelled'],
      acknowledged: ['en_route', 'assigned'],
      en_route: ['on_scene', 'acknowledged'],
      on_scene: ['working', 'en_route'],
      working: ['completed', 'on_scene'],
      completed: ['working'],
      cancelled: ['assigned'],
    };

    const allowed = validTransitions[from] || [];
    if (!allowed.includes(to)) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `Invalid assignment status transition from ${from} to ${to}`,
        retryable: false,
      });
    }
  }

  private applyScopeFilter(query: Knex.QueryBuilder, user: UserPayload): Knex.QueryBuilder {
    if (user.roles.includes('org_admin')) {
      const orgIds = user.memberships
        .filter((m) => m.status === 'active')
        .map((m) => m.organization_id);
      return query.whereIn('response_teams.organization_id', orgIds);
    }

    if (user.permissions.includes('assignment:read:own')) {
      const orgIds = user.memberships
        .filter((m) => m.status === 'active' && m.role_code === 'team_lead')
        .map((m) => m.organization_id);
      if (orgIds.length > 0) {
        return query.whereIn('response_teams.organization_id', orgIds);
      }
    }

    return query.where('assignments.assigned_by_user_id', user.user_id);
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

  private encodeCursor(data: { assigned_at: Date; assignment_id: string }): string {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  private decodeCursor(cursor: string): { assigned_at: Date; assignment_id: string } {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString());
    } catch {
      return { assigned_at: new Date(), assignment_id: '' };
    }
  }
}