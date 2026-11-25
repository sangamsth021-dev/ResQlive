import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserPayload } from '../common/interfaces/user-payload.interface';

@ApiTags('Users')
@Controller('api/v1/users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  async getProfile(@CurrentUser() user: UserPayload) {
    return this.usersService.getProfile(user.user_id);
  }

  @Get('me/memberships')
  @ApiOperation({ summary: 'Get current user organization memberships' })
  @ApiResponse({ status: 200, description: 'User memberships' })
  async getMemberships(@CurrentUser() user: UserPayload) {
    return this.usersService.getMemberships(user.user_id);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  async updateProfile(
    @CurrentUser() user: UserPayload,
    @Body() data: {
      display_name?: string;
      avatar_url?: string;
      default_organization_id?: string | null;
    },
  ) {
    await this.usersService.updateProfile(user.user_id, data);
    return { message: 'Profile updated successfully' };
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password' })
  @ApiResponse({ status: 200, description: 'Password changed' })
  async changePassword(
    @CurrentUser() user: UserPayload,
    @Body() data: { current_password: string; new_password: string },
  ) {
    await this.usersService.changePassword(user.user_id, data.current_password, data.new_password);
    return { message: 'Password changed successfully' };
  }

  @Patch('me/default-organization')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set default organization' })
  @ApiResponse({ status: 200, description: 'Default organization updated' })
  async setDefaultOrganization(
    @CurrentUser() user: UserPayload,
    @Body('organization_id') organizationId: string | null,
  ) {
    await this.usersService.setDefaultOrganization(user.user_id, organizationId);
    return { message: 'Default organization updated successfully' };
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get user by ID (org_admin scope)' })
  @ApiResponse({ status: 200, description: 'User profile' })
  async getUser(@Param('userId') userId: string, @CurrentUser() user: UserPayload) {
    // Check if user has org_admin role or is requesting their own profile
    if (user.user_id !== userId && !user.roles.includes('org_admin')) {
      throw new Error('Insufficient permissions');
    }
    return this.usersService.getProfile(userId);
  }
}