import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import appConfig from '../../../config/app.config';

/**
 * JWT Strategy
 * Validates JWT tokens and extracts user information
 * Works with all user roles: patient, doctor, shop_owner, admin
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // ignoreExpiration: false,
      ignoreExpiration: true,
      secretOrKey: appConfig().jwt.secret,
    });
  }

  /**
   * Validate JWT payload
   * Extracts user information from token
   * @param payload - JWT payload containing user information
   * @returns User object with userId and email
   */
  async validate(payload: any) {
    // Extract user information from JWT payload
    // payload.sub contains user ID
    // payload.email contains user email
    // This works with all user roles (patient, doctor, shop_owner, admin)
    return { userId: payload.sub, email: payload.email };
  }
}
