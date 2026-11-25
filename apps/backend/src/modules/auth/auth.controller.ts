import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';

import { AuthService } from './auth.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DeviceAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserPayload, DevicePayload } from '../../common/interfaces/user-payload.interface';

@ApiTags('Authentication')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a new session (login)' })
  @ApiResponse({
    status: 200,
    description: 'Session created successfully',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        refresh_token: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            user_id: { type: 'string', format: 'uuid' },
            device_id: { type: 'string', format: 'uuid' },
            organization_id: { type: 'string', format: 'uuid' },
            memberships: { type: 'array', items: { type: 'object' } },
            roles: { type: 'array', items: { type: 'string' } },
            permissions: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async createSession(
    @Body() dto: CreateSessionDto,
    @Req() req: Request,
  ) {
    return this.authService.createSession(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        refresh_token: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refreshSession(@Body() dto: RefreshSessionDto) {
    return this.authService.refreshSession(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke current session' })
  @ApiResponse({ status: 200, description: 'Session revoked' })
  async logout(
    @CurrentUser() user: UserPayload,
    @Req() req: Request,
  ) {
    const deviceId = req.headers['x-device-id'] as string || user.device_id;
    await this.authService.logout(user.user_id, deviceId);
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile and memberships' })
  @ApiResponse({
    status: 200,
    description: 'Current user info',
    type: 'object',
  })
  async getMe(@CurrentUser() user: UserPayload) {
    return { user };
  }

  @Post('devices/register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a new device for the authenticated user' })
  @ApiResponse({
    status: 201,
    description: 'Device registered successfully',
    schema: {
      type: 'object',
      properties: {
        device_id: { type: 'string', format: 'uuid' },
        device_token: { type: 'string' },
      },
    },
  })
  async registerDevice(
    @Body() dto: RegisterDeviceDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.authService.registerDevice(dto, user.user_id);
  }

  @Post('devices/revoke')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a registered device' })
  @ApiResponse({ status: 200, description: 'Device revoked' })
  async revokeDevice(
    @Body('device_id') deviceId: string,
    @CurrentUser() user: UserPayload,
  ) {
    // This would need additional service method - placeholder
    return { message: 'Device revocation requested', device_id: deviceId };
  }
}