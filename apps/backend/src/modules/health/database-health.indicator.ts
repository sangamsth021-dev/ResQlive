import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { Knex } from 'knex';
import { InjectConnection } from 'nestjs-knex';

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(@InjectConnection() private readonly knex: Knex) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Simple query to check database connectivity
      await this.knex.raw('SELECT 1');

      // Check if migrations are up to date
      const migrationCount = await this.knex('knex_migrations').count('* as count').first();
      const migrationLock = await this.knex('knex_migrations_lock').where('is_locked', 1).first();

      return this.getStatus(key, true, {
        connected: true,
        migrations_applied: parseInt(String(migrationCount?.count || '0'), 10),
        migration_locked: !!migrationLock,
      });
    } catch (error) {
      throw new HealthCheckError(
        'Database check failed',
        this.getStatus(key, false, { connected: false, error: error.message }),
      );
    }
  }
}