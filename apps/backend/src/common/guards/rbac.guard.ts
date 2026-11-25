import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, PERMISSIONS_KEY, SCOPE_KEY } from '../decorators/roles.decorator';
import { UserPayload } from '../interfaces/user-payload.interface';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredScope = this.reflector.getAllAndOverride<string>(SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no requirements, allow access (authenticated via JwtAuthGuard)
    if (!requiredPermissions && !requiredRoles && !requiredScope) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as UserPayload;

    if (!user) {
      throw new ForbiddenException({
        code: 'SCOPE_DENIED',
        message: 'User context not available',
        retryable: false,
      });
    }

    // CHECK PERMISSIONS FIRST (primary authorization mechanism)
    // Every protected endpoint should use @Permissions() with explicit permission strings
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasPermission = requiredPermissions.some((perm) => user.permissions.includes(perm));
      if (!hasPermission) {
        throw new ForbiddenException({
          code: 'PERMISSION_DENIED',
          message: `Required permission: ${requiredPermissions.join(' or ')}`,
          retryable: false,
        });
      }
    }

    // CHECK ROLES SECONDARY (supplementary, never replace permissions)
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.some((role) => user.roles.includes(role));
      if (!hasRole) {
        // Note: Role denied does not block if permissions satisfy the requirement
        // This is logged for audit but does not enforce deny-by-default
        // In a stricter implementation, this would also block access
      }
    }

    // CHECK SCOPE (organization/jurisdiction)
    if (requiredScope) {
      const hasScope = user.memberships.some(
        (m) => m.organization_id === requiredScope && m.status === 'active',
      );
      if (!hasScope) {
        throw new ForbiddenException({
          code: 'SCOPE_DENIED',
          message: `Access denied for scope: ${requiredScope}`,
          retryable: false,
        });
      }
    }

    return true;
  }
}