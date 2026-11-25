import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { Knex } from 'knex';
import { InjectConnection } from 'nestjs-knex';

@Injectable()
export class SyncHealthIndicator extends HealthIndicator {
  constructor(@InjectConnection() private readonly knex: Knex) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Check sync tables
      const outboxCount = await this.knex('sync_outbox')
        .where('created_at', '>', new Date(Date.now() - 3600000)) // last hour
        .count('* as count')
        .first();

      const inboxCount = await this.knex('sync_inbox')
        .where('received_at', '>', new Date(Date.now() - 3600000)) // last hour
        .count('* as count')
        .first();

      const failedInbox = await this.knex('sync_inbox')
        .where('status', 'failed')
        .where('received_at', '>', new Date(Date.now() - 3600000))
        .count('* as count')
        .first();

      const activeNodes = await this.knex('sync_nodes')
        .where('node_status', 'active')
        .where('last_seen_at', '>', new Date(Date.now() - 300000)) // last 5 minutes
        .count('* as count')
        .first();

      return this.getStatus(key, true, {
        outbox_events_last_hour: parseInt(String(outboxCount?.count || '0'), 10),
        inbox_events_last_hour: parseInt(String(inboxCount?.count || '0'), 10),
        failed_inbox_last_hour: parseInt(String(failedInbox?.count || '0'), 10),
        active_nodes: parseInt(String(activeNodes?.count || '0'), 10),
      });
    } catch (error) {
      throw new HealthCheckError(
        'Sync check failed',
        this.getStatus(key, false, { error: error.message }),
      );
    }
  }
}