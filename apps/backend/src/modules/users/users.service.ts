import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectConnection } from 'nestjs-knex';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';

import { UserPayload, OrganizationMembership } from '../common/interfaces/user-payload.interface';

@Injectable()
export class UsersService {
  constructor(@InjectConnection() private readonly knex: Knex) {}

  async getProfile(userId: string): Promise<{
    user_id: string;
    phone_e164: string;
    email: string | null;
    display_name: string;
    avatar_url: string | null;
    default_organization_id: string | null;
    account_status: string;
    created_at: Date;
  }> {
    const user = await this.knex('users')
      .select(
        'user_id',
        'phone_e164',
        'email',
        'display_name',
        'avatar_url',
        'default_organization_id',
        'account_status',
        'created_at',
      )
      .where('user_id', userId)
      .first();

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
        retryable: false,
      });
    }

    return user;
  }

  async getMemberships(userId: string): Promise<OrganizationMembership[]> {
    return this.knex('organization_memberships')
      .where('user_id', userId)
      .orderBy('created_at', 'desc');
  }

  async updateProfile(
    userId: string,
    data: {
      display_name?: string;
      avatar_url?: string;
      default_organization_id?: string | null;
    },
  ): Promise<void> {
    await this.knex('users').where('user_id', userId).update(data);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.knex('users')
      .select('password_hash')
      .where('user_id', userId)
      .first();

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
        retryable: false,
      });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      throw new ForbiddenException({
        code: 'INVALID_CREDENTIALS',
        message: 'Current password is incorrect',
        retryable: false,
      });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await this.knex('users').where('user_id', userId).update({ password_hash: newHash });
  }

  async setDefaultOrganization(userId: string, organizationId: string | null): Promise<void> {
    if (organizationId) {
      // Verify user is a member of this organization
      const membership = await this.knex('organization_memberships')
        .where('user_id', userId)
        .where('organization_id', organizationId)
        .where('status', 'active')
        .first();

      if (!membership) {
        throw new ForbiddenException({
          code: 'SCOPE_DENIED',
          message: 'Not a member of this organization',
          retryable: false,
        });
      }
    }

    await this.knex('users').where('user_id', userId).update({
      default_organization_id: organizationId,
    });
  }

  async getUserByPhone(phoneE164: string): Promise<UserPayload | null> {
    const user = await this.knex('users')
      .where('phone_e164', phoneE164)
      .first();

    if (!user) return null;

    const memberships = await this.getMemberships(user.user_id);
    const roles = [...new Set(memberships.map((m) => m.role_code))];

    return {
      user_id: user.user_id,
      device_id: '',
      organization_id: memberships[0]?.organization_id || '',
      memberships,
      roles,
      permissions: this.buildPermissions(roles),
    };
  }

  async getUserByEmail(email: string): Promise<UserPayload | null> {
    const user = await this.knex('users')
      .where('email', email)
      .first();

    if (!user) return null;

    const memberships = await this.getMemberships(user.user_id);
    const roles = [...new Set(memberships.map((m) => m.role_code))];

    return {
      user_id: user.user_id,
      device_id: '',
      organization_id: memberships[0]?.organization_id || '',
      memberships,
      roles,
      permissions: this.buildPermissions(roles),
    };
  }

  private buildPermissions(roles: string[]): string[] {
    const rolePermissions: Record<string, string[]> = {
      reporter: ['report:create', 'report:read:own', 'evidence:upload'],
      operator: ['report:read:scope', 'report:acknowledge', 'incident:read:scope'],
      verifier: ['report:read:scope', 'report:verify', 'incident:read:scope', 'incident:create'],
      team_lead: ['assignment:read:own', 'assignment:update:own', 'incident:read:scope'],
      org_admin: [
        'user:read:org',
        'user:manage:org',
        'device:manage:org',
        'report:read:org',
        'incident:manage:org',
        'team:manage:org',
        'reference:manage:org',
      ],
    };

    const permissions = new Set<string>();
    for (const role of roles) {
      const perms = rolePermissions[role] || [];
      perms.forEach((p) => permissions.add(p));
    }
    return Array.from(permissions);
  }
}