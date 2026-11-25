import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Knex } from 'knex';
import { InjectConnection } from 'nestjs-knex';
import { v4 as uuidv4 } from 'uuid';

import { PushEventsDto, PullChangesQueryDto } from './dto';
import { UserPayload, DevicePayload } from '../common/interfaces/user-payload.interface';

@Injectable()
export class SyncService {
  constructor(@InjectConnection() private readonly knex: Knex) {}

  async pushEvents(dto: PushEventsDto, user: UserPayload | DevicePayload): Promise<{
    accepted: string[];
    already_processed: string[];
    rejected: Array<{ event_id: string; reason: string }>;
  }> {
    const accepted: string[] = [];
    const alreadyProcessed: string[] = [];
    const rejected: Array<{ event_id: string; reason: string }> = [];

    for (const event of dto.events) {
      try {
        // Validate event structure
        this.validateEvent(event);

        // Check if event already processed (idempotency)
        const existing = await this.knex('sync_inbox')
          .where('event_id', event.event_id)
          .where('origin_node_id', dto.origin_node_id)
          .first();

        if (existing) {
          if (existing.status === 'processed') {
            alreadyProcessed.push(event.event_id);
            continue;
          } else if (existing.status === 'processing') {
            rejected.push({ event_id: event.event_id, reason: 'EVENT_PROCESSING' });
            continue;
          }
        }

        // Insert into inbox
        await this.knex('sync_inbox').insert({
          event_id: event.event_id,
          origin_node_id: dto.origin_node_id,
          stream_name: event.stream_name,
          aggregate_type: event.aggregate_type,
          aggregate_id: event.aggregate_id,
          event_type: event.event_type,
          schema_version: event.schema_version,
          occurred_at_device: new Date(event.occurred_at_device),
          payload_hash: event.payload_hash,
          payload: event.payload,
          status: 'processing',
          received_at: new Date(),
        });

        // Apply event based on type
        await this.applyEvent(event, user);

        // Mark as processed
        await this.knex('sync_inbox')
          .where('event_id', event.event_id)
          .where('origin_node_id', dto.origin_node_id)
          .update({ status: 'processed', processed_at: new Date() });

        accepted.push(event.event_id);
      } catch (error) {
        // Mark as failed
        await this.knex('sync_inbox')
          .where('event_id', event.event_id)
          .where('origin_node_id', dto.origin_node_id)
          .update({ status: 'failed', error_message: error.message });

        rejected.push({ event_id: event.event_id, reason: error.message });
      }
    }

    return { accepted, already_processed, rejected };
  }

  async pullChanges(query: PullChangesQueryDto, user: UserPayload | DevicePayload): Promise<{
    events: any[];
    cursor: string | null;
    has_more: boolean;
  }> {
    // Get cursor for this stream
    let cursor = query.cursor;
    if (!cursor) {
      const cursorRecord = await this.knex('sync_cursors')
        .where('node_id', this.getNodeId(user))
        .where('stream_name', query.stream)
        .first();
      cursor = cursorRecord?.cursor || null;
    }

    // Build query for outbox events
    let q = this.knex('sync_outbox')
      .select(
        'event_id',
        'origin_node_id',
        'stream_name',
        'aggregate_type',
        'aggregate_id',
        'event_type',
        'schema_version',
        'occurred_at_device',
        'payload_hash',
        'payload',
        'created_at',
      )
      .where('stream_name', query.stream)
      .where('created_at', '>', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // 30 days retention

    // Apply scope filtering based on user/device
    q = this.applyScopeFilter(q, user);

    // Cursor-based pagination
    if (cursor) {
      const cursorData = this.decodeCursor(cursor);
      q = q.where('created_at', '>', new Date(cursorData.created_at))
        .orWhere(function () {
          this.where('created_at', '=', new Date(cursorData.created_at))
            .andWhere('event_id', '>', cursorData.event_id);
        });
    }

    const limit = Math.min(query.limit || 100, 500);
    q = q.orderBy('created_at', 'asc').orderBy('event_id', 'asc').limit(limit + 1);

    const events = await q;

    let nextCursor: string | null = null;
    if (events.length > limit) {
      const last = events[limit - 1];
      nextCursor = this.encodeCursor({ created_at: last.created_at, event_id: last.event_id });
      events.pop();
    }

    return {
      events,
      cursor: nextCursor,
      has_more: !!nextCursor,
    };
  }

  async acknowledgeCursor(stream: string, cursor: string, user: UserPayload | DevicePayload): Promise<void> {
    const nodeId = this.getNodeId(user);
    const cursorData = this.decodeCursor(cursor);

    await this.knex('sync_cursors').insert({
      node_id: nodeId,
      stream_name: stream,
      cursor: cursor,
      sequence: cursorData.sequence || 0,
      last_event_id: cursorData.event_id,
      updated_at: new Date(),
    })
    .onConflict(['node_id', 'stream_name'])
    .merge({
      cursor: cursor,
      sequence: cursorData.sequence || 0,
      last_event_id: cursorData.event_id,
      updated_at: new Date(),
    });
  }

  async registerNode(nodeData: {
    node_id: string;
    node_type: string;
    organization_id: string;
    capabilities_json?: Record<string, any>;
    public_key?: string;
  }): Promise<void> {
    await this.knex('sync_nodes').insert({
      ...nodeData,
      node_status: 'active',
      last_seen_at: new Date(),
    })
    .onConflict(['node_id'])
    .merge({
      node_status: 'active',
      last_seen_at: new Date(),
      capabilities_json: nodeData.capabilities_json,
      public_key: nodeData.public_key,
    });
  }

  async heartbeat(nodeId: string): Promise<void> {
    await this.knex('sync_nodes')
      .where('node_id', nodeId)
      .update({ last_seen_at: new Date() });
  }

  private validateEvent(event: any): void {
    if (!event.event_id || !event.aggregate_type || !event.aggregate_id || !event.event_type) {
      throw new BadRequestException({
        code: 'INVALID_EVENT',
        message: 'Event missing required fields',
        retryable: false,
      });
    }

    if (!event.payload_hash || !event.payload) {
      throw new BadRequestException({
        code: 'INVALID_EVENT',
        message: 'Event missing payload or hash',
        retryable: false,
      });
    }

    // Verify payload hash
    const crypto = require('crypto');
    const payloadStr = JSON.stringify(event.payload);
    const calculatedHash = crypto.createHash('sha256').update(payloadStr).digest('hex');

    if (calculatedHash !== event.payload_hash) {
      throw new BadRequestException({
        code: 'PAYLOAD_HASH_MISMATCH',
        message: 'Event payload hash does not match',
        retryable: false,
      });
    }
  }

  private async applyEvent(event: any, user: UserPayload | DevicePayload): Promise<void> {
    const { aggregate_type, aggregate_id, event_type, payload } = event;

    switch (aggregate_type) {
      case 'REPORT':
        await this.applyReportEvent(aggregate_id, event_type, payload, user);
        break;
      case 'INCIDENT':
        await this.applyIncidentEvent(aggregate_id, event_type, payload, user);
        break;
      case 'ASSIGNMENT':
        await this.applyAssignmentEvent(aggregate_id, event_type, payload, user);
        break;
      case 'EVIDENCE':
        await this.applyEvidenceEvent(aggregate_id, event_type, payload, user);
        break;
      default:
        // Unknown aggregate type - just log
        console.warn(`Unknown aggregate type: ${aggregate_type}`);
    }
  }

  private async applyReportEvent(reportId: string, eventType: string, payload: any, user: UserPayload | DevicePayload): Promise<void> {
    switch (eventType) {
      case 'REPORT_SUBMITTED':
        // Report already exists in DB from original submission
        // Just ensure status is correct
        await this.knex('reports')
          .where('report_id', reportId)
          .update({ report_status: 'submitted', updated_at: new Date() });
        break;
      case 'REPORT_ACKNOWLEDGED':
        await this.knex('reports')
          .where('report_id', reportId)
          .update({ report_status: 'acknowledged', updated_at: new Date() });
        break;
      case 'REPORT_AMENDED':
        // Amendments already applied
        break;
    }
  }

  private async applyIncidentEvent(incidentId: string, eventType: string, payload: any, user: UserPayload | DevicePayload): Promise<void> {
    const statusMap: Record<string, string> = {
      'INCIDENT_CREATED': 'new',
      'INCIDENT_TRIAGED': 'triaged',
      'INCIDENT_VERIFIED': 'verified',
      'INCIDENT_ASSIGNED': 'assigned',
      'INCIDENT_DISPATCHED': 'dispatched',
      'INCIDENT_RESPONSE_IN_PROGRESS': 'response_in_progress',
      'INCIDENT_RESOLVED': 'resolved',
      'INCIDENT_CLOSED': 'closed',
      'INCIDENT_REJECTED': 'rejected',
    };

    const status = statusMap[eventType];
    if (status) {
      await this.knex('incidents')
        .where('incident_id', incidentId)
        .update({ incident_status: status, updated_at: new Date() });
    }
  }

  private async applyAssignmentEvent(assignmentId: string, eventType: string, payload: any, user: UserPayload | DevicePayload): Promise<void> {
    const statusMap: Record<string, string> = {
      'ASSIGNMENT_CREATED': 'assigned',
      'ASSIGNMENT_ACKNOWLEDGED': 'acknowledged',
      'ASSIGNMENT_EN_ROUTE': 'en_route',
      'ASSIGNMENT_ON_SCENE': 'on_scene',
      'ASSIGNMENT_WORKING': 'working',
      'ASSIGNMENT_COMPLETED': 'completed',
      'ASSIGNMENT_CANCELLED': 'cancelled',
    };

    const status = statusMap[eventType];
    if (status) {
      const updates: any = { assignment_status: status, updated_at: new Date() };
      const now = new Date();

      switch (status) {
        case 'acknowledged':
          updates.acknowledged_at = now;
          break;
        case 'en_route':
          updates.en_route_at = now;
          break;
        case 'on_scene':
          updates.on_scene_at = now;
          break;
        case 'completed':
          updates.completed_at = now;
          break;
      }

      await this.knex('assignments')
        .where('assignment_id', assignmentId)
        .update(updates);
    }
  }

  private async applyEvidenceEvent(evidenceId: string, eventType: string, payload: any, user: UserPayload | DevicePayload): Promise<void> {
    // Evidence events mainly for status updates
  }

  private getNodeId(user: UserPayload | DevicePayload): string {
    if ('device_id' in user) {
      return `device-${user.device_id}`;
    }
    return `user-${user.user_id}`;
  }

  private applyScopeFilter(query: Knex.QueryBuilder, user: UserPayload | DevicePayload): Knex.QueryBuilder {
    // For sync, we filter based on organization membership
    if ('memberships' in user) {
      const orgIds = user.memberships
        .filter((m) => m.status === 'active')
        .map((m) => m.organization_id);

      if (orgIds.length > 0) {
        // Join with reports/incidents/assignments to filter by organization
        // This is simplified - in practice you'd need more complex joins
      }
    }
    return query;
  }

  private encodeCursor(data: { created_at: Date; event_id: string; sequence?: number }): string {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  private decodeCursor(cursor: string): { created_at: Date; event_id: string; sequence?: number } {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString());
    } catch {
      return { created_at: new Date(0), event_id: '', sequence: 0 };
    }
  }
}