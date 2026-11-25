import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { SyncService } from './sync.service';
import { PushEventsDto, PullChangesQueryDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DeviceAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserPayload, DevicePayload } from '../common/interfaces/user-payload.interface';

@ApiTags('Sync')
@Controller('api/v1/sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('events')
  @HttpCode(HttpStatus.OK)
  @UseGuards(DeviceAuthGuard)
  @ApiOperation({ summary: 'Push events from device (device-originated)' })
  @ApiResponse({ status: 200, description: 'Events processed' })
  @ApiResponse({ status: 400, description: 'Invalid events' })
  async pushEvents(
    @Body() dto: PushEventsDto,
    @CurrentUser() device: DevicePayload,
  ) {
    return this.syncService.pushEvents(dto, device);
  }

  @Get('changes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pull changes for a stream' })
  @ApiResponse({ status: 200, description: 'Changes with cursor' })
  async pullChanges(
    @Query() query: PullChangesQueryDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.syncService.pullChanges(query, user);
  }

  @Post('acknowledge')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Acknowledge cursor position' })
  @ApiResponse({ status: 200, description: 'Cursor acknowledged' })
  async acknowledgeCursor(
    @Body() data: { stream: string; cursor: string },
    @CurrentUser() user: UserPayload,
  ) {
    await this.syncService.acknowledgeCursor(data.stream, data.cursor, user);
    return { message: 'Cursor acknowledged' };
  }

  @Post('nodes/register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(DeviceAuthGuard)
  @ApiOperation({ summary: 'Register sync node (EOC edge node or device)' })
  @ApiResponse({ status: 201, description: 'Node registered' })
  async registerNode(
    @Body() data: {
      node_id: string;
      node_type: string;
      organization_id: string;
      capabilities_json?: Record<string, any>;
      public_key?: string;
    },
    @CurrentUser() device: DevicePayload,
  ) {
    await this.syncService.registerNode(data);
    return { message: 'Node registered successfully' };
  }

  @Post('nodes/heartbeat')
  @HttpCode(HttpStatus.OK)
  @UseGuards(DeviceAuthGuard)
  @ApiOperation({ summary: 'Node heartbeat' })
  @ApiResponse({ status: 200, description: 'Heartbeat recorded' })
  async heartbeat(@CurrentUser() device: DevicePayload) {
    await this.syncService.heartbeat(device.device_id);
    return { message: 'Heartbeat recorded' };
  }
}