import { SetMetadata } from '@nestjs/common';
import { Role } from './role.enum';

/**
 * Roles metadata key
 * Used to store role requirements in route metadata
 */
export const ROLES_KEY = 'roles';

/**
 * Roles decorator
 * Used to specify required roles for a route
 * @param roles - Array of required roles
 * @returns Metadata decorator
 * @example
 * @Roles(Role.PATIENT)
 * @Roles(Role.DOCTOR, Role.ADMIN)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
