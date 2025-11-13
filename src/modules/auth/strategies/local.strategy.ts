import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

/**
 * Local Strategy
 * Validates user credentials (email and password)
 * Works with all user roles: patient, doctor, shop_owner, admin
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'email' });
  }

  /**
   * Validate user credentials
   * Checks email and password against database
   * @param email - User email address
   * @param password - User password
   * @returns User object if credentials are valid
   * @throws UnauthorizedException if credentials are invalid
   */
  async validate(email: string, password: string): Promise<any> {
    try {
      // Validate user credentials
      // This works with all user roles (patient, doctor, shop_owner, admin)
      const user = await this.authService.validateUser(email, password);

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw new UnauthorizedException(error.message);
      }
      // Re-throw other errors
      throw error;
    }
  }
}
