/**
 * User roles enum
 * Defines all available user roles in the system
 */
export enum Role {
  PATIENT = 'patient',
  DOCTOR = 'doctor',
  SHOP_OWNER = 'shop_owner',
  ADMIN = 'admin',
  // Keep USER for backward compatibility (can be removed later)
  USER = 'user',
}
