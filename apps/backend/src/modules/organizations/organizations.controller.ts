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

import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles, Permissions, Scope } from '../common/decorators/roles.decorator';
import { RbacGuard } from '../common/guards/rbac.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserPayload } from '../common/interfaces/user-payload.interface';

@ApiTags('Organizations')
@Controller('api/v1/organizations')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @Roles('org_admin')
  @Scope(':organizationId') // Will be validated after creation
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new organization (org_admin only)' })
  @ApiResponse({ status: 201, description: 'Organization created' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async createOrganization(@Body() data: {
    name: string;
    type_code: string;
    parent_organization_id?: string | null;
    jurisdiction_geom?: any;
    timezone?: string;
    metadata_json?: Record<string, any>;
  }) {
    return this.organizationsService.createOrganization(data);
  }

  @Get()
  @Roles('org_admin')
  @ApiOperation({ summary: 'List organizations (org_admin scope)' })
  @ApiResponse({ status: 200, description: 'Organizations list' })
  async listOrganizations(
    @Query('type_code') type_code?: string,
    @Query('status') status?: string,
    @Query('parent_organization_id') parent_organization_id?: string,
  ) {
    return this.organizationsService.listOrganizations({ type_code, status, parent_organization_id });
  }

  @Get('hierarchy/:organizationId')
  @Roles('org_admin')
  @Scope(':organizationId')
  @ApiOperation({ summary: 'Get organization hierarchy' })
  @ApiResponse({ status: 200, description: 'Organization hierarchy' })
  async getHierarchy(@Param('organizationId') organizationId: string) {
    return this.organizationsService.getHierarchy(organizationId);
  }

  @Get(':organizationId')
  @Roles('org_admin')
  @Scope(':organizationId')
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiResponse({ status: 200, description: 'Organization details' })
  async getOrganization(@Param('organizationId') organizationId: string) {
    return this.organizationsService.getOrganization(organizationId);
  }

  @Patch(':organizationId')
  @Roles('org_admin')
  @Scope(':organizationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update organization' })
  @ApiResponse({ status: 200, description: 'Organization updated' })
  async updateOrganization(
    @Param('organizationId') organizationId: string,
    @Body() data: {
      name?: string;
      type_code?: string;
      jurisdiction_geom?: any;
      timezone?: string;
      metadata_json?: Record<string, any>;
      status?: string;
    },
  ) {
    await this.organizationsService.updateOrganization(organizationId, data);
    return { message: 'Organization updated successfully' };
  }

  // Membership endpoints
  @Post(':organizationId/memberships')
  @Roles('org_admin')
  @Scope(':organizationId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add user membership to organization' })
  @ApiResponse({ status: 201, description: 'Membership created' })
  async addMembership(
    @Param('organizationId') organizationId: string,
    @Body() data: {
      user_id: string;
      role_code: string;
      scope_json?: Record<string, any>;
      valid_from?: Date;
      valid_to?: Date;
    },
  ) {
    return this.organizationsService.addMembership({ ...data, organization_id: organizationId });
  }

  @Get(':organizationId/memberships')
  @Roles('org_admin')
  @Scope(':organizationId')
  @ApiOperation({ summary: 'List memberships in organization' })
  @ApiResponse({ status: 200, description: 'Memberships list' })
  async listMemberships(
    @Param('organizationId') organizationId: string,
    @Query('user_id') user_id?: string,
    @Query('status') status?: string,
    @Query('role_code') role_code?: string,
  ) {
    return this.organizationsService.listMemberships(organizationId, { user_id, status, role_code });
  }

  @Patch('memberships/:membershipId')
  @Roles('org_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update membership' })
  @ApiResponse({ status: 200, description: 'Membership updated' })
  async updateMembership(
    @Param('membershipId') membershipId: string,
    @Body() data: {
      role_code?: string;
      scope_json?: Record<string, any>;
      status?: string;
      valid_from?: Date | null;
      valid_to?: Date | null;
    },
  ) {
    await this.organizationsService.updateMembership(membershipId, data);
    return { message: 'Membership updated successfully' };
  }

  @Delete('memberships/:membershipId')
  @Roles('org_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove membership (revoke)' })
  @ApiResponse({ status: 200, description: 'Membership revoked' })
  async removeMembership(@Param('membershipId') membershipId: string) {
    await this.organizationsService.removeMembership(membershipId);
    return { message: 'Membership revoked successfully' };
  }

  @Get('users/:userId/memberships')
  @ApiOperation({ summary: 'Get memberships for a user (org_admin or self)' })
  @ApiResponse({ status: 200, description: 'User memberships' })
  async getUserMemberships(
    @Param('userId') userId: string,
    @CurrentUser() user: UserPayload,
  ) {
    // Allow org_admin or self
    if (user.user_id !== userId && !user.roles.includes('org_admin')) {
      throw new Error('Insufficient permissions');
    }
    return this.organizationsService.getUserMemberships(userId);
  }
}