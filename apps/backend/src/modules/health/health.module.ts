import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DatabaseHealthIndicator } from './database-health.indicator';
import { StorageHealthIndicator } from './storage-health.indicator';
import { SyncHealthIndicator } from './sync-health.indicator';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [TerminusModule, DatabaseModule],
  controllers: [HealthController],
  providers: [
    DatabaseHealthIndicator,
    StorageHealthIndicator,
    SyncHealthIndicator,
  ],
})
export class HealthModule {}