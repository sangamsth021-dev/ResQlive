import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Knex } from 'knex';
import { InjectConnection } from 'nestjs-knex';
import { v4 as uuidv4 } from 'uuid';

import { ListAuditLogsQueryDto, ExportAuditLogsDto } from './dto';
import { UserPayload } from '../common/interfaces/user-payload.interface';

@Injectable()
export class AuditService {
  constructor(@InjectConnection() private readonly knex: Knex) {}

  async logAudit(data: {
    actor_user_id: string | null;
    actor_role: string;
    action: string;
    target_type: string;
    target_id: string;
    metadata_json?: Record<string, any>;
    occurred_at?: Date;
  }): Promise<{ audit_id: string }> {
    const audit_id = uuidv4();

    await this.knex('audit_logs').insert({
      audit_id,
      actor_user_id: data.actor_user_id,
      actor_role: data.actor_role,
      action: data.action,
      target_type: data.target_type,
      target_id: data.target_id,
      metadata_json: data.metadata_json || {},
      occurred_at: data.occurred_at || new Date(),
    });

    return { audit_id };
  }

  async listAuditLogs(query: ListAuditLogsQueryDto, user: UserPayload): Promise<{
    logs: any[];
    cursor: string | null;
    has_more: boolean;
  }> {
    // Check if user has audit permissions
    if (!user.permissions.includes('audit:read') && !user.roles.includes('org_admin')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Insufficient permissions to access audit logs',
        retryable: false,
      });
    }

    let q = this.knex('audit_logs').select('*');

    // Apply scope filtering for org_admin
    if (user.roles.includes('org_admin') && !user.permissions.includes('audit:read')) {
      // Org admin can only see audit logs for their organization's entities
      // This is a simplified version - in practice you'd join with the target entities
      const orgIds = user.memberships
        .filter((m) => m.status === 'active')
        .map((m) => m.organization_id);
      // For now, just return all - proper implementation would filter by target organization
    }

    // Apply filters
    if (query.action) {
      q = q.where('action', 'like', `%${query.action}%`);
    }
    if (query.target_type) {
      q = q.where('target_type', query.target_type);
    }
    if (query.target_id) {
      q = q.where('target_id', query.target_id);
    }
    if (query.actor_user_id) {
      q = q.where('actor_user_id', query.actor_user_id);
    }
    if (query.actor_role) {
      q = q.where('actor_role', query.actor_role);
    }
    if (query.from_date) {
      q = q.where('occurred_at', '>=', new Date(query.from_date));
    }
    if (query.to_date) {
      q = q.where('occurred_at', '<=', new Date(query.to_date));
    }

    // Cursor-based pagination
    if (query.cursor) {
      const cursorData = this.decodeCursor(query.cursor);
      q = q.where('occurred_at', '<', new Date(cursorData.occurred_at));
      if (cursorData.audit_id) {
        q = q.where(function () {
          this.where('occurred_at', '<', new Date(cursorData.occurred_at))
            .orWhere(function () {
              this.where('occurred_at', '=', new Date(cursorData.occurred_at))
                .andWhere('audit_id', '<', cursorData.audit_id);
            });
        });
      }
    }

    const limit = Math.min(query.limit || 100, 500);
    q = q.orderBy('occurred_at', 'desc').orderBy('audit_id', 'desc').limit(limit + 1);

    const logs = await q;

    let nextCursor: string | null = null;
    if (logs.length > limit) {
      const last = logs[limit - 1];
      nextCursor = this.encodeCursor({ occurred_at: last.occurred_at, audit_id: last.audit_id });
      logs.pop();
    }

    return {
      logs,
      cursor: nextCursor,
      has_more: !!nextCursor,
    };
  }

  async exportAuditLogs(dto: ExportAuditLogsDto, user: UserPayload): Promise<{
    export_id: string;
    status: string;
    download_url?: string;
    expires_at?: Date;
  }> {
    // Check if user has export permissions
    if (!user.permissions.includes('audit:export') && !user.roles.includes('org_admin')) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Insufficient permissions to export audit logs',
        retryable: false,
      });
    }

    // For now, return a synchronous export
    // In production, this would be async with a job queue
    let q = this.knex('audit_logs').select('*');

    if (dto.action) {
      q = q.where('action', 'like', `%${dto.action}%`);
    }
    if (dto.target_type) {
      q = q.where('target_type', dto.target_type);
    }
    if (dto.target_id) {
      q = q.where('target_id', dto.target_id);
    }
    if (dto.actor_user_id) {
      q = q.where('actor_user_id', dto.actor_user_id);
    }
    if (dto.from_date) {
      q = q.where('occurred_at', '>=', new Date(dto.from_date));
    }
    if (dto.to_date) {
      q = q.where('occurred_at', '<=', new Date(dto.to_date));
    }

    // Limit to reasonable number
    q = q.orderBy('occurred_at', 'desc').limit(10000);

    const logs = await q;

    // Generate CSV or JSON
    const format = dto.format || 'json';
    let content: string;
    let mimeType: string;

    if (format === 'csv') {
      const headers = ['audit_id', 'actor_user_id', 'actor_role', 'action', 'target_type', 'target_id', 'metadata_json', 'occurred_at'];
      const rows = logs.map(log => [
        log.audit_id,
        log.actor_user_id || '',
        log.actor_role,
        log.action,
        log.target_type,
        log.target_id,
        JSON.stringify(log.metadata_json),
        log.occurred_at.toISOString(),
      ]);
      content = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
      mimeType = 'text/csv';
    } else {
      content = JSON.stringify(logs, null, 2);
      mimeType = 'application/json';
    }

    // In production, upload to object storage and return presigned URL
    // For now, return the content directly (not suitable for large exports)
    const export_id = uuidv4();

    return {
      export_id,
      status: 'completed',
      download_url: `data:${mimeType};base64,${Buffer.from(content).toString('base64')}`,
      expires_at: new Date(Date.now() + 3600000), // 1 hour
    };
  }

  private encodeCursor(data: { occurred_at: Date; audit_id: string }): string {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  private decodeCursor(cursor: string): { occurred_at: Date; audit_id: string } {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString());
    } catch {
      return { occurred_at: new Date(), audit_id: '' };
    }
  }
}