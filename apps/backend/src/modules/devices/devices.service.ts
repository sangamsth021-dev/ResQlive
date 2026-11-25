import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Knex } from 'knex';
import { InjectConnection } from 'nestjs-knex';
import { v4 as uuidv4 } from 'uuid';

import { DevicePayload } from '../common/interfaces/user-payload.interface';

@Injectable()
export class DevicesService {
  constructor(@InjectConnection() private readonly knex: Knex) {}

  async registerDevice(
    userId: string,
    data: {
      organization_id: string;
      platform: string;
      app_version: string;
      public_key: string;
      key_algorithm: string;
    },
  ): Promise<{ device_id: string; device_token: string }> {
    // Check if device already registered for this user with same public key
    const existing = await this.knex('devices')
      .where('user_id', userId)
      .where('public_key', data.public_key)
      .first();

    if (existing) {
      // Update existing device
      await this.knex('devices')
        .where('device_id', existing.device_id)
        .update({
          platform: data.platform,
          app_version: data.app_version,
          device_status: 'active',
          last_seen_at: new Date(),
        });

      return { device_id: existing.device_id, device_token: '' }; // Token generated in auth service
    }

    const device_id = uuidv4();
    await this.knex('devices').insert({
      device_id,
      user_id: userId,
      organization_id: data.organization_id,
      platform: data.platform,
      app_version: data.app_version,
      public_key: data.public_key,
      key_algorithm: data.key_algorithm,
      device_status: 'active',
      last_seen_at: new Date(),
    });

    return { device_id, device_token: '' }; // Token generated in auth service
  }

  async getDevice(deviceId: string): Promise<DevicePayload> {
    const device = await this.knex('devices')
      .where('device_id', deviceId)
      .first();

    if (!device) {
      throw new NotFoundException({
        code: 'DEVICE_NOT_FOUND',
        message: 'Device not found',
        retryable: false,
      });
    }

    return {
      device_id: device.device_id,
      user_id: device.user_id,
      organization_id: device.organization_id,
      device_status: device.device_status,
    };
  }

  async listDevices(
    userId: string,
    filters?: { organization_id?: string; device_status?: string },
  ): Promise<any[]> {
    let query = this.knex('devices').where('user_id', userId);

    if (filters?.organization_id) {
      query = query.where('organization_id', filters.organization_id);
    }
    if (filters?.device_status) {
      query = query.where('device_status', filters.device_status);
    }

    return query.orderBy('last_seen_at', 'desc');
  }

  async updateDevice(
    deviceId: string,
    userId: string,
    data: {
      platform?: string;
      app_version?: string;
      device_status?: string;
    },
  ): Promise<void> {
    const device = await this.knex('devices')
      .where('device_id', deviceId)
      .where('user_id', userId)
      .first();

    if (!device) {
      throw new NotFoundException({
        code: 'DEVICE_NOT_FOUND',
        message: 'Device not found',
        retryable: false,
      });
    }

    await this.knex('devices')
      .where('device_id', deviceId)
      .update({
        ...data,
        last_seen_at: new Date(),
      });
  }

  async revokeDevice(deviceId: string, userId: string): Promise<void> {
    const device = await this.knex('devices')
      .where('device_id', deviceId)
      .where('user_id', userId)
      .first();

    if (!device) {
      throw new NotFoundException({
        code: 'DEVICE_NOT_FOUND',
        message: 'Device not found',
        retryable: false,
      });
    }

    await this.knex('devices')
      .where('device_id', deviceId)
      .update({
        device_status: 'revoked',
        revoked_at: new Date(),
      });

    // Also revoke all refresh tokens for this device
    await this.knex('refresh_tokens')
      .where('device_id', deviceId)
      .update({ revoked: true, revoked_at: new Date() });
  }

  async updateLastSeen(deviceId: string): Promise<void> {
    await this.knex('devices')
      .where('device_id', deviceId)
      .update({ last_seen_at: new Date() });
  }

  async getDeviceByPublicKey(userId: string, publicKey: string): Promise<any> {
    return this.knex('devices')
      .where('user_id', userId)
      .where('public_key', publicKey)
      .first();
  }
}