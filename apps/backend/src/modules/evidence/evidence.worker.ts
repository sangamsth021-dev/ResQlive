import { Injectable, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { EvidenceService } from './evidence.service';

@Injectable()
export class EvidenceWorker {
  private readonly logger = new Logger(EvidenceWorker.name);
  private readonly worker: Worker;

  constructor(
    private readonly evidenceService: EvidenceService,
    @InjectQueue('evidence-verification') private readonly verificationQueue: Queue,
  ) {
    this.worker = new Worker(
      'evidence-verification',
      async (job: Job) => {
        await this.processVerification(job);
      },
      {
        concurrency: parseInt(process.env.EVIDENCE_WORKER_CONCURRENCY || '3', 10),
        limiter: {
          max: 10,
          duration: 60000, // 10 per minute
        },
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Verification job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Verification job ${job?.id} failed: ${err.message}`);
    });
  }

  async queueVerification(evidenceId: string): Promise<void> {
    await this.verificationQueue.add(
      'verify',
      { evidence_id: evidenceId },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    );
  }

  private async processVerification(job: Job<{ evidence_id: string }>): Promise<void> {
    const { evidence_id } = job.data;
    this.logger.log(`Processing verification for evidence ${evidence_id}`);

    await this.evidenceService.verifyEvidence(evidence_id);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
  }
}