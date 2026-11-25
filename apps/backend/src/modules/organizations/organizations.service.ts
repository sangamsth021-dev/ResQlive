import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Knex } from 'knex';
import { InjectConnection } from 'nestjs-knex';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OrganizationsService {
  constructor(@InjectConnection() private readonly knex: Knex) {}

  async createOrganization(data: {
    name: string;
    type_code: string;
    parent_organization_id?: string | null;
    jurisdiction_geom?: any;
    timezone?: string;
    metadata_json?: Record<string, any>;
  }): Promise<{ organization_id: string }> {
    // Validate parent organization exists if provided
    if (data.parent_organization_id) {
      const parent = await this.knex('organizations')
        .where('organization_id', data.parent_organization_id)
        .first();
      if (!parent) {
        throw new NotFoundException({
          code: 'PARENT_ORG_NOT_FOUND',
          message: 'Parent organization not found',
          retryable: false,
        });
      }
    }

    // Validate type_code exists
    const type = await this.knex('organization_types')
      .where('type_code', data.type_code)
      .first();
    if (!type) {
      throw new NotFoundException({
        code: 'INVALID_ORG_TYPE',
        message: 'Invalid organization type',
        retryable: false,
      });
    }

    const organization_id = uuidv4();
    await this.knex('organizations').insert({
      organization_id,
      name: data.name,
      type_code: data.type_code,
      parent_organization_id: data.parent_organization_id || null,
      jurisdiction_geom: data.jurisdiction_geom || null,
      timezone: data.timezone || 'UTC',
      metadata_json: data.metadata_json || {},
      status: 'active',
    });

    return { organization_id };
  }

  async getOrganization(organizationId: string): Promise<any> {
    const org = await this.knex('organizations')
      .where('organization_id', organizationId)
      .first();

    if (!org) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization not found',
        retryable: false,
      });
    }

    return org;
  }

  async listOrganizations(filters?: {
    type_code?: string;
    status?: string;
    parent_organization_id?: string | null;
  }): Promise<any[]> {
    let query = this.knex('organizations').select('*');

    if (filters?.type_code) {
      query = query.where('type_code', filters.type_code);
    }
    if (filters?.status) {
      query = query.where('status', filters.status);
    }
    if (filters?.parent_organization_id !== undefined) {
      if (filters.parent_organization_id === null) {
        query = query.whereNull('parent_organization_id');
      } else {
        query = query.where('parent_organization_id', filters.parent_organization_id);
      }
    }

    return query.orderBy('name');
  }

  async updateOrganization(
    organizationId: string,
    data: {
      name?: string;
      type_code?: string;
      jurisdiction_geom?: any;
      timezone?: string;
      metadata_json?: Record<string, any>;
      status?: string;
    },
  ): Promise<void> {
    const org = await this.getOrganization(organizationId);

    if (data.type_code) {
      const type = await this.knex('organization_types')
        .where('type_code', data.type_code)
        .first();
      if (!type) {
        throw new NotFoundException({
          code: 'INVALID_ORG_TYPE',
          message: 'Invalid organization type',
          retryable: false,
        });
      }
    }

    await this.knex('organizations').where('organization_id', organizationId).update(data);
  }

  async getHierarchy(organizationId: string): Promise<any> {
    // Get the organization and its children recursively
    const org = await this.getOrganization(organizationId);
    const children = await this.getChildren(organizationId);
    return { ...org, children };
  }

  private async getChildren(parentId: string): Promise<any[]> {
    const children = await this.knex('organizations')
      .where('parent_organization_id', parentId)
      .orderBy('name');

    for (const child of children) {
      child.children = await this.getChildren(child.organization_id);
    }

    return children;
  }

  async addMembership(data: {
    user_id: string;
    organization_id: string;
    role_code: string;
    scope_json?: Record<string, any>;
    valid_from?: Date;
    valid_to?: Date;
  }): Promise<{ membership_id: string }> {
    // Verify user exists
    const user = await this.knex('users').where('user_id', data.user_id).first();
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
        retryable: false,
      });
    }

    // Verify organization exists
    await this.getOrganization(data.organization_id);

    // Verify role exists
    const role = await this.knex('roles').where('role_code', data.role_code).first();
    if (!role) {
      throw new NotFoundException({
        code: 'INVALID_ROLE',
        message: 'Invalid role',
        retryable: false,
      });
    }

    // Check for existing active membership with same role
    const existing = await this.knex('organization_memberships')
      .where('user_id', data.user_id)
      .where('organization_id', data.organization_id)
      .where('role_code', data.role_code)
      .where('status', 'active')
      .first();

    if (existing) {
      throw new ConflictException({
        code: 'MEMBERSHIP_EXISTS',
        message: 'Active membership with this role already exists',
        retryable: false,
      });
    }

    const membership_id = uuidv4();
    await this.knex('organization_memberships').insert({
      membership_id,
      user_id: data.user_id,
      organization_id: data.organization_id,
      role_code: data.role_code,
      scope_json: data.scope_json || {},
      status: 'active',
      valid_from: data.valid_from || null,
      valid_to: data.valid_to || null,
    });

    return { membership_id };
  }

  async updateMembership(
    membershipId: string,
    data: {
      role_code?: string;
      scope_json?: Record<string, any>;
      status?: string;
      valid_from?: Date | null;
      valid_to?: Date | null;
    },
  ): Promise<void> {
    const membership = await this.knex('organization_memberships')
      .where('membership_id', membershipId)
      .first();

    if (!membership) {
      throw new NotFoundException({
        code: 'MEMBERSHIP_NOT_FOUND',
        message: 'Membership not found',
        retryable: false,
      });
    }

    if (data.role_code) {
      const role = await this.knex('roles').where('role_code', data.role_code).first();
      if (!role) {
        throw new NotFoundException({
          code: 'INVALID_ROLE',
          message: 'Invalid role',
          retryable: false,
        });
      }
    }

    await this.knex('organization_memberships')
      .where('membership_id', membershipId)
      .update(data);
  }

  async removeMembership(membershipId: string): Promise<void> {
    const membership = await this.knex('organization_memberships')
      .where('membership_id', membershipId)
      .first();

    if (!membership) {
      throw new NotFoundException({
        code: 'MEMBERSHIP_NOT_FOUND',
        message: 'Membership not found',
        retryable: false,
      });
    }

    await this.knex('organization_memberships')
      .where('membership_id', membershipId)
      .update({ status: 'revoked' });
  }

  async listMemberships(
    organizationId: string,
    filters?: { user_id?: string; status?: string; role_code?: string },
  ): Promise<any[]> {
    let query = this.knex('organization_memberships')
      .where('organization_id', organizationId);

    if (filters?.user_id) {
      query = query.where('user_id', filters.user_id);
    }
    if (filters?.status) {
      query = query.where('status', filters.status);
    }
    if (filters?.role_code) {
      query = query.where('role_code', filters.role_code);
    }

    return query.orderBy('created_at', 'desc');
  }

  async getUserMemberships(userId: string): Promise<any[]> {
    return this.knex('organization_memberships')
      .where('user_id', userId)
      .orderBy('created_at', 'desc');
  }
}