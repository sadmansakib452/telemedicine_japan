import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';

/**
 * DTO for creating a new broadcast
 * Used when a patient wants to send a medical issue message to all doctors
 */
export class CreateBroadcastDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000, {
    message: 'Message cannot exceed 5000 characters',
  })
  @ApiProperty({
    description:
      'The medical issue message that will be broadcasted to all doctors',
    example:
      'I have been experiencing severe headaches for the past 3 days. The pain is mostly on the left side of my head.',
    maxLength: 5000,
  })
  message: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description:
      'The ID of the patient creating the broadcast (usually extracted from JWT token)',
    example: 'clx1234567890abcdef',
    required: false,
  })
  patient_id?: string;
}
