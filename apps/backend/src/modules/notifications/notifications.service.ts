import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Knex } from 'knex';
import { InjectConnection } from 'nestjs-knex';
import { v4 as uuidv4 } from 'uuid';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { CreateNotificationDto, ListNotificationsQueryDto } from './dto';
import { UserPayload } from '../common/interfaces/user-payload.interface';

type NotificationChannel = 'push' | 'sms' | 'email' | 'in_app';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectConnection() private readonly knex: Knex,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  async createNotification(dto: CreateNotificationDto): Promise<{ notification_id: string }> {
    // Verify user exists
    const user = await this.knex('users')
      .where('user_id', dto.user_id)
      .first();

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
        retryable: false,
      });
    }

    const notification_id = uuidv4();
    const now = new Date();

    await this.knex('notifications').insert({
      notification_id,
      user_id: dto.user_id,
      channel: dto.channel,
      template_code: dto.template_code,
      template_data_json: dto.template_data_json || {},
      priority: dto.priority || 'normal',
      notification_status: 'pending',
      related_type: dto.related_type || null,
      related_id: dto.related_id || null,
      scheduled_for: dto.scheduled_for ? new Date(dto.scheduled_for) : now,
      created_at: now,
    });

    // Queue for delivery
    await this.queueNotification(notification_id);

    return { notification_id };
  }

  async createBulkNotifications(
    userIds: string[],
    templateCode: string,
    templateData: Record<string, any>,
    options?: {
      channel?: NotificationChannel;
      priority?: string;
      related_type?: string;
      related_id?: string;
    },
  ): Promise<{ notification_ids: string[] }> {
    const now = new Date();
    const notificationIds: string[] = [];

    const records = userIds.map((userId) => {
      const notification_id = uuidv4();
      notificationIds.push(notification_id);
      return {
        notification_id,
        user_id: userId,
        channel: options?.channel || 'in_app',
        template_code: templateCode,
        template_data_json: templateData,
        priority: options?.priority || 'normal',
        notification_status: 'pending',
        related_type: options?.related_type || null,
        related_id: options?.related_id || null,
        scheduled_for: now,
        created_at: now,
      };
    });

    await this.knex('notifications').insert(records);

    // Queue all for delivery
    for (const id of notificationIds) {
      await this.queueNotification(id);
    }

    return { notification_ids: notificationIds };
  }

  async getNotification(notificationId: string, user: UserPayload): Promise<any> {
    const notification = await this.knex('notifications')
      .where('notification_id', notificationId)
      .where('user_id', user.user_id)
      .first();

    if (!notification) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification not found',
        retryable: false,
      });
    }

    return notification;
  }

  async listNotifications(query: ListNotificationsQueryDto, user: UserPayload): Promise<{
    notifications: any[];
    cursor: string | null;
    has_more: boolean;
  }> {
    let q = this.knex('notifications')
      .where('user_id', user.user_id)
      .select('*');

    if (query.notification_status) {
      q = q.where('notification_status', query.notification_status);
    }
    if (query.channel) {
      q = q.where('channel', query.channel);
    }
    if (query.from_date) {
      q = q.where('created_at', '>=', new Date(query.from_date));
    }
    if (query.to_date) {
      q = q.where('created_at', '<=', new Date(query.to_date));
    }

    if (query.cursor) {
      const cursorData = this.decodeCursor(query.cursor);
      q = q.where('created_at', '<', new Date(cursorData.created_at));
      if (cursorData.notification_id) {
        q = q.where(function () {
          this.where('created_at', '<', new Date(cursorData.created_at))
            .orWhere(function () {
              this.where('created_at', '=', new Date(cursorData.created_at))
                .andWhere('notification_id', '<', cursorData.notification_id);
            });
        });
      }
    }

    const limit = Math.min(query.limit || 50, 200);
    q = q.orderBy('created_at', 'desc').orderBy('notification_id', 'desc').limit(limit + 1);

    const notifications = await q;

    let nextCursor: string | null = null;
    if (notifications.length > limit) {
      const last = notifications[limit - 1];
      nextCursor = this.encodeCursor({ created_at: last.created_at, notification_id: last.notification_id });
      notifications.pop();
    }

    return {
      notifications,
      cursor: nextCursor,
      has_more: !!nextCursor,
    };
  }

  async markAsRead(notificationId: string, user: UserPayload): Promise<void> {
    await this.knex('notifications')
      .where('notification_id', notificationId)
      .where('user_id', user.user_id)
      .update({
        notification_status: 'read',
        read_at: new Date(),
      });
  }

  async markAllAsRead(user: UserPayload): Promise<void> {
    await this.knex('notifications')
      .where('user_id', user.user_id)
      .where('notification_status', 'delivered')
      .update({
        notification_status: 'read',
        read_at: new Date(),
      });
  }

  async queueNotification(notificationId: string): Promise<void> {
    await this.notificationsQueue.add(
      'deliver',
      { notification_id: notificationId },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  }

  async deliverNotification(notificationId: string): Promise<void> {
    const notification = await this.knex('notifications')
      .where('notification_id', notificationId)
      .first();

    if (!notification) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification not found',
        retryable: false,
      });
    }

    if (notification.notification_status !== 'pending') {
      return; // Already processed
    }

    // Update to processing
    await this.knex('notifications')
      .where('notification_id', notificationId)
      .update({ notification_status: 'processing', processing_at: new Date() });

    try {
      // Deliver based on channel
      switch (notification.channel) {
        case 'push':
          await this.deliverPush(notification);
          break;
        case 'sms':
          await this.deliverSms(notification);
          break;
        case 'email':
          await this.deliverEmail(notification);
          break;
        case 'in_app':
          // In-app notifications are just stored in DB
          break;
      }

      // Mark as delivered
      await this.knex('notifications')
        .where('notification_id', notificationId)
        .update({
          notification_status: 'delivered',
          delivered_at: new Date(),
        });
    } catch (error) {
      // Mark as failed, will be retried by BullMQ
      await this.knex('notifications')
        .where('notification_id', notificationId)
        .update({
          notification_status: 'failed',
          error_message: error.message,
        });
      throw error;
    }
  }

  private async deliverPush(notification: any): Promise<void> {
    // Get user's FCM tokens from devices
    const devices = await this.knex('devices')
      .where('user_id', notification.user_id)
      .where('device_status', 'active')
      .whereNotNull('push_token')
      .select('push_token');

    if (devices.length === 0) {
      throw new Error('No push tokens available');
    }

    // In production, use Firebase Admin SDK
    // For now, just log
    console.log(`[PUSH] Would send to ${devices.length} devices:`, notification.template_code);
  }

  private async deliverSms(notification: any): Promise<void> {
    // Get user's phone number
    const user = await this.knex('users')
      .where('user_id', notification.user_id)
      .select('phone_e164')
      .first();

    if (!user?.phone_e164) {
      throw new Error('No phone number available');
    }

    // In production, use Twilio or similar
    console.log(`[SMS] Would send to ${user.phone_e164}:`, notification.template_code);
  }

  private async deliverEmail(notification: any): Promise<void> {
    // Get user's email
    const user = await this.knex('users')
      .where('user_id', notification.user_id)
      .select('email')
      .first();

    if (!user?.email) {
      throw new Error('No email available');
    }

    // In production, use SendGrid, SES, or SMTP
    console.log(`[EMAIL] Would send to ${user.email}:`, notification.template_code);
  }

  private encodeCursor(data: { created_at: Date; notification_id: string }): string {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  private decodeCursor(cursor: string): { created_at: Date; notification_id: string } {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString());
    } catch {
      return { created_at: new Date(), notification_id: '' };
    }
  }
}