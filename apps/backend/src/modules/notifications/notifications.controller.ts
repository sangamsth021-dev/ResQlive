import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { NotificationsService } from './notifications.service';
import { CreateNotificationDto, ListNotificationsQueryDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RbacGuard } from '../common/guards/rbac.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/roles.decorator';
import { UserPayload } from '../common/interfaces/user-payload.interface';

@ApiTags('Notifications')
@Controller('api/v1/notifications')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('org_admin') // Only admins can send notifications directly
  @ApiOperation({ summary: 'Create a notification (admin)' })
  @ApiResponse({ status: 201, description: 'Notification created' })
  async createNotification(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.createNotification(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List notifications for current user' })
  @ApiResponse({ status: 200, description: 'Notifications list with cursor' })
  async listNotifications(
    @Query() query: ListNotificationsQueryDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.notificationsService.listNotifications(query, user);
  }

  @Get(':notificationId')
  @ApiOperation({ summary: 'Get notification detail' })
  @ApiResponse({ status: 200, description: 'Notification detail' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async getNotification(
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: UserPayload,
  ) {
    return this.notificationsService.getNotification(notificationId, user);
  }

  @Patch(':notificationId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  async markAsRead(
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: UserPayload,
  ) {
    await this.notificationsService.markAsRead(notificationId, user);
    return { message: 'Notification marked as read' };
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllAsRead(@CurrentUser() user: UserPayload) {
    await this.notificationsService.markAllAsRead(user);
    return { message: 'All notifications marked as read' };
  }
}