import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { DevicesService } from './devices.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DeviceAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserPayload, DevicePayload } from '../common/interfaces/user-payload.interface';

@ApiTags('Devices')
@Controller('api/v1/devices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new device for the authenticated user' })
  @ApiResponse({ status: 201, description: 'Device registered' })
  async registerDevice(
    @Body() data: {
      organization_id: string;
      platform: string;
      app_version: string;
      public_key: string;
      key_algorithm: string;
    },
    @CurrentUser() user: UserPayload,
  ) {
    return this.devicesService.registerDevice(user.user_id, data);
  }

  @Get()
  @ApiOperation({ summary: 'List devices for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Devices list' })
  async listDevices(
    @CurrentUser() user: UserPayload,
    @Query('organization_id') organization_id?: string,
    @Query('device_status') device_status?: string,
  ) {
    return this.devicesService.listDevices(user.user_id, { organization_id, device_status });
  }

  @Get(':deviceId')
  @ApiOperation({ summary: 'Get device by ID' })
  @ApiResponse({ status: 200, description: 'Device details' })
  async getDevice(@Param('deviceId') deviceId: string, @CurrentUser() user: UserPayload) {
    const device = await this.devicesService.getDevice(deviceId);
    if (device.user_id !== user.user_id && !user.roles.includes('org_admin')) {
      throw new Error('Insufficient permissions');
    }
    return device;
  }

  @Patch(':deviceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update device' })
  @ApiResponse({ status: 200, description: 'Device updated' })
  async updateDevice(
    @Param('deviceId') deviceId: string,
    @CurrentUser() user: UserPayload,
    @Body() data: {
      platform?: string;
      app_version?: string;
      device_status?: string;
    },
  ) {
    await this.devicesService.updateDevice(deviceId, user.user_id, data);
    return { message: 'Device updated successfully' };
  }

  @Post(':deviceId/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke device' })
  @ApiResponse({ status: 200, description: 'Device revoked' })
  async revokeDevice(@Param('deviceId') deviceId: string, @CurrentUser() user: UserPayload) {
    await this.devicesService.revokeDevice(deviceId, user.user_id);
    return { message: 'Device revoked successfully' };
  }

  // Device-originated endpoint for updating last_seen
  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  @UseGuards(DeviceAuthGuard)
  @ApiOperation({ summary: 'Device heartbeat (device-originated)' })
  @ApiResponse({ status: 200, description: 'Heartbeat recorded' })
  async heartbeat(@CurrentUser() device: DevicePayload) {
    await this.devicesService.updateLastSeen(device.device_id);
    return { message: 'Heartbeat recorded' };
  }
}