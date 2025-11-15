import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { Role } from './role.enum';
import { UserRepository } from '../../../common/repository/user/user.repository';

/**
 * Roles Guard
 * Validates user roles for route access
 * Checks if user type matches required roles
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  /**
   * Check if user has required role
   * @param context - Execution context
   * @returns boolean - true if user has required role, false otherwise
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required roles from decorator
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Get user from request
    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.userId) {
      throw new HttpException(
        'User not authenticated',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Get user details from database
    const userDetails = await UserRepository.getUserDetails(user.userId);

    if (!userDetails) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    // Check if user type matches any of the required roles
    // Use equality check instead of includes() for proper role validation
    const hasRequiredRole = requiredRoles.some(
      (role) => userDetails.type === role,
    );

    if (hasRequiredRole) {
      return true;
    } else {
      throw new HttpException(
        `You do not have permission to access this resource. Required role: ${requiredRoles.join(', ')}. Your role: ${userDetails.type}`,
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
