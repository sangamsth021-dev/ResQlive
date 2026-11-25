import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Knex } from 'knex';
import { InjectConnection } from 'nestjs-knex';
import { v4 as uuidv4 } from 'uuid';

import { CreateSessionDto } from './dto/create-session.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { UserPayload, DevicePayload } from '../../common/interfaces/user-payload.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectConnection() private readonly knex: Knex,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async createSession(dto: CreateSessionDto): Promise<{
    access_token: string;
    refresh_token: string;
    user: UserPayload;
  }> {
    // Find user by phone or email
    const user = await this.knex('users')
      .where(function () {
        if (dto.phone_e164) {
          this.where('phone_e164', dto.phone_e164);
        }
        if (dto.email) {
          this.orWhere('email', dto.email);
        }
      })
      .first();

    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
        retryable: false,
      });
    }

    if (user.account_status !== 'active') {
      throw new UnauthorizedException({
        code: 'ACCOUNT_DISABLED',
        message: 'Account is not active',
        retryable: false,
      });
    }

    // Verify password (using bcrypt)
    const isValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
        retryable: false,
      });
    }

    // Get active memberships
    const memberships = await this.knex('organization_memberships')
      .where('user_id', user.user_id)
      .where('status', 'active')
      .where(function () {
        this.whereNull('valid_from').orWhere('valid_from', '<=', new Date());
      })
      .where(function () {
        this.whereNull('valid_to').orWhere('valid_to', '>=', new Date());
      });

    // Get roles from memberships
    const roles = [...new Set(memberships.map((m) => m.role_code))];

    // Build permissions from roles
    const permissions = this.buildPermissions(roles);

    const userPayload: UserPayload = {
      user_id: user.user_id,
      device_id: dto.device_id || '',
      organization_id: memberships[0]?.organization_id || '',
      memberships: memberships.map((m) => ({
        membership_id: m.membership_id,
        organization_id: m.organization_id,
        role_code: m.role_code,
        scope_json: m.scope_json,
        status: m.status,
        valid_from: m.valid_from,
        valid_to: m.valid_to,
      })),
      roles,
      permissions,
    };

    // Generate tokens
    const access_token = await this.generateAccessToken(userPayload);
    const refresh_token = await this.generateRefreshToken(user.user_id, dto.device_id);

    // Store refresh token hash
    await this.storeRefreshToken(user.user_id, dto.device_id, refresh_token);

    this.logger.log(`Session created for user ${user.user_id}`);

    return {
      access_token,
      refresh_token,
      user: userPayload,
    };
  }

  async refreshSession(dto: RefreshSessionDto): Promise<{
    access_token: string;
    refresh_token: string;
  }> {
    // Verify refresh token
    const stored = await this.knex('refresh_tokens')
      .where('user_id', dto.user_id)
      .where('device_id', dto.device_id)
      .where('revoked', false)
      .where('expires_at', '>', new Date())
      .first();

    if (!stored) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired refresh token',
        retryable: false,
      });
    }

    const isValid = await bcrypt.compare(dto.refresh_token, stored.token_hash);
    if (!isValid) {
      // Possible token reuse - revoke all tokens for this user/device
      await this.knex('refresh_tokens')
        .where('user_id', dto.user_id)
        .where('device_id', dto.device_id)
        .update({ revoked: true, revoked_at: new Date() });

      throw new UnauthorizedException({
        code: 'TOKEN_REUSE_DETECTED',
        message: 'Token reuse detected - all sessions revoked',
        retryable: false,
      });
    }

    // Rotate refresh token
    await this.knex('refresh_tokens')
      .where('token_id', stored.token_id)
      .update({ revoked: true, revoked_at: new Date() });

    // Get current user and memberships
    const user = await this.knex('users').where('user_id', dto.user_id).first();
    if (!user || user.account_status !== 'active') {
      throw new UnauthorizedException({
        code: 'ACCOUNT_DISABLED',
        message: 'Account is not active',
        retryable: false,
      });
    }

    const memberships = await this.knex('organization_memberships')
      .where('user_id', user.user_id)
      .where('status', 'active');

    const roles = [...new Set(memberships.map((m) => m.role_code))];
    const permissions = this.buildPermissions(roles);

    const userPayload: UserPayload = {
      user_id: user.user_id,
      device_id: dto.device_id,
      organization_id: memberships[0]?.organization_id || '',
      memberships: memberships.map((m) => ({
        membership_id: m.membership_id,
        organization_id: m.organization_id,
        role_code: m.role_code,
        scope_json: m.scope_json,
        status: m.status,
        valid_from: m.valid_from,
        valid_to: m.valid_to,
      })),
      roles,
      permissions,
    };

    const access_token = await this.generateAccessToken(userPayload);
    const new_refresh_token = await this.generateRefreshToken(user.user_id, dto.device_id);
    await this.storeRefreshToken(user.user_id, dto.device_id, new_refresh_token);

    return { access_token, refresh_token: new_refresh_token };
  }

  async logout(userId: string, deviceId: string): Promise<void> {
    await this.knex('refresh_tokens')
      .where('user_id', userId)
      .where('device_id', deviceId)
      .update({ revoked: true, revoked_at: new Date() });

    this.logger.log(`Session revoked for user ${userId}, device ${deviceId}`);
  }

  async registerDevice(dto: RegisterDeviceDto, userId: string): Promise<{
    device_id: string;
    device_token: string;
  }> {
    // Check if device already registered for this user
    const existing = await this.knex('devices')
      .where('user_id', userId)
      .where('public_key', dto.public_key)
      .first();

    if (existing) {
      // Update existing device
      await this.knex('devices')
        .where('device_id', existing.device_id)
        .update({
          platform: dto.platform,
          app_version: dto.app_version,
          device_status: 'active',
          last_seen_at: new Date(),
        });

      const device_token = await this.generateDeviceToken(existing.device_id, userId, dto.organization_id);
      return { device_id: existing.device_id, device_token };
    }

    // Create new device
    const device_id = uuidv4();
    await this.knex('devices').insert({
      device_id,
      user_id: userId,
      organization_id: dto.organization_id,
      platform: dto.platform,
      app_version: dto.app_version,
      public_key: dto.public_key,
      key_algorithm: dto.key_algorithm,
      device_status: 'active',
      last_seen_at: new Date(),
    });

    const device_token = await this.generateDeviceToken(device_id, userId, dto.organization_id);
    this.logger.log(`Device registered: ${device_id} for user ${userId}`);

    return { device_id, device_token };
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

  private async generateAccessToken(payload: UserPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRATION', '15m'),
    });
  }

  private async generateRefreshToken(userId: string, deviceId: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, device_id: deviceId, type: 'refresh' },
      {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '30d'),
      },
    );
  }

  private async generateDeviceToken(deviceId: string, userId: string, organizationId: string): Promise<string> {
    return this.jwtService.signAsync(
      { device_id: deviceId, user_id: userId, organization_id: organizationId, type: 'device' },
      {
        secret: this.configService.get('JWT_DEVICE_SECRET'),
        expiresIn: this.configService.get('JWT_DEVICE_EXPIRATION', '365d'),
      },
    );
  }

  private async storeRefreshToken(userId: string, deviceId: string, refreshToken: string): Promise<void> {
    const tokenHash = await bcrypt.hash(refreshToken, 12);
    const expiresIn = this.configService.get('JWT_REFRESH_EXPIRATION', '30d');
    const expiresAt = new Date(Date.now() + this.parseExpiration(expiresIn));

    await this.knex('refresh_tokens').insert({
      token_id: uuidv4(),
      user_id: userId,
      device_id: deviceId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      revoked: false,
    });
  }

  private parseExpiration(exp: string): number {
    const match = exp.match(/^(\d+)([smhd])$/);
    if (!match) return 30 * 24 * 60 * 60 * 1000; // 30 days default

    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
    return value * (multipliers[unit as keyof typeof multipliers] || 1);
  }
}