import { Module } from '@nestjs/common';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { EvidenceWorker } from './evidence.worker';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'evidence-verification',
    }),
  ],
  controllers: [EvidenceController],
  providers: [EvidenceService, EvidenceWorker],
  exports: [EvidenceService],
})
export class EvidenceModule {}