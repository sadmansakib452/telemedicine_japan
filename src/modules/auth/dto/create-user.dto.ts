import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength, IsOptional, IsIn } from 'class-validator';

/**
 * Create User DTO
 * Used for user registration
 * Validates that only patient, doctor, or shop_owner can be registered
 * Admin registration is not allowed through this endpoint
 */
export class CreateUserDto {
  @IsNotEmpty()
  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
  })
  name?: string;

  @IsNotEmpty()
  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  first_name?: string;

  @IsNotEmpty()
  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  last_name?: string;

  @IsNotEmpty()
  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
  })
  email?: string;

  @IsNotEmpty()
  @MinLength(8, { message: 'Password should be minimum 8 characters' })
  @ApiProperty({
    description: 'User password',
    example: 'password123',
    minLength: 8,
  })
  password: string;

  @IsOptional()
  @IsIn(['patient', 'doctor', 'shop_owner'], {
    message:
      'Type must be one of: patient, doctor, shop_owner. Admin registration is not allowed.',
  })
  @ApiProperty({
    description: 'User type/role',
    enum: ['patient', 'doctor', 'shop_owner'],
    example: 'patient',
    required: false,
    default: 'patient',
  })
  type?: string;
}
