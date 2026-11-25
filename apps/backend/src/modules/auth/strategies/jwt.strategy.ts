import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UserPayload } from '../../common/interfaces/user-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => req?.cookies?.access_token,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_ACCESS_SECRET', 'access_secret_key_change_me_in_prod'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: UserPayload): Promise<UserPayload> {
    // Validate that the payload has required fields
    if (!payload.user_id || !payload.roles || !Array.isArray(payload.roles)) {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Invalid token payload',
        retryable: false,
      });
    }

    // Attach the full payload to request for guards to use
    return payload;
  }
}