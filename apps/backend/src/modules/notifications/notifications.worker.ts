import { Injectable, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsWorker {
  private readonly logger = new Logger(NotificationsWorker.name);
  private readonly worker: Worker;

  constructor(
    private readonly notificationsService: NotificationsService,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {
    this.worker = new Worker(
      'notifications',
      async (job: Job) => {
        await this.processDelivery(job);
      },
      {
        concurrency: parseInt(process.env.NOTIFICATIONS_WORKER_CONCURRENCY || '10', 10),
        limiter: {
          max: 100,
          duration: 60000, // 100 per minute
        },
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.debug(`Notification delivery job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Notification delivery job ${job?.id} failed: ${err.message}`);
    });
  }

  private async processDelivery(job: Job<{ notification_id: string }>): Promise<void> {
    const { notification_id } = job.data;
    this.logger.log(`Delivering notification ${notification_id}`);

    await this.notificationsService.deliverNotification(notification_id);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
  }
}