import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UserPayload, DevicePayload } from '../interfaces/user-payload.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Bearer token required',
        retryable: false,
      });
    }

    const token = authHeader.substring(7);

    try {
      const payload = await this.jwtService.verifyAsync<UserPayload>(token, {
        secret: this.configService.get('JWT_ACCESS_SECRET'),
      });

      // Attach user to request
      request.user = payload;
      return true;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException({
          code: 'TOKEN_EXPIRED',
          message: 'Access token expired',
          retryable: false,
        });
      }
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Invalid or malformed token',
        retryable: false,
      });
    }
  }
}

// Device guard for device-originated writes
@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const deviceId = request.headers['x-device-id'] as string;
    if (!deviceId) {
      throw new UnauthorizedException({
        code: 'DEVICE_ID_REQUIRED',
        message: 'X-Device-ID header required for device-originated writes',
        retryable: false,
      });
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Bearer token required',
        retryable: false,
      });
    }

    const token = authHeader.substring(7);

    try {
      const payload = await this.jwtService.verifyAsync<DevicePayload>(token, {
        secret: this.configService.get('JWT_DEVICE_SECRET'),
      });

      if (payload.device_id !== deviceId) {
        throw new UnauthorizedException({
          code: 'DEVICE_MISMATCH',
          message: 'Device ID does not match token',
          retryable: false,
        });
      }

      if (payload.device_status === 'revoked') {
        throw new UnauthorizedException({
          code: 'DEVICE_REVOKED',
          message: 'Device has been revoked',
          retryable: false,
        });
      }

      request.device = payload;
      return true;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException({
          code: 'TOKEN_EXPIRED',
          message: 'Device token expired',
          retryable: false,
        });
      }
      throw new UnauthorizedException({
        code: 'INVALID_DEVICE_TOKEN',
        message: 'Invalid device token',
        retryable: false,
      });
    }
  }
}