import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsIn,
  ValidateIf,
} from 'class-validator';

/**
 * DTO for creating a new message
 * Supports both text messages and prescription messages
 */
export class CreateMessageDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'The ID of the message receiver',
    example: 'clx1234567890abcdef',
  })
  receiver_id: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'The ID of the conversation',
    example: 'clx9876543210fedcba',
  })
  conversation_id: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'The message text content (required for text messages)',
    example: 'Hello, how are you?',
    required: false,
  })
  message?: string;

  @IsOptional()
  @IsString()
  @IsIn(['text', 'prescription'], {
    message: 'Message type must be either "text" or "prescription"',
  })
  @ApiProperty({
    description: 'The type of message',
    enum: ['text', 'prescription'],
    default: 'text',
    example: 'text',
    required: false,
  })
  message_type?: string;

  @ValidateIf((o) => o.message_type === 'prescription')
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description:
      'Prescription medicine details (required for prescription messages)',
    example: 'Paracetamol 500mg - 2 tablets, 3 times daily for 5 days',
    required: false,
  })
  medicine_details?: string;

  @ValidateIf((o) => o.message_type === 'prescription')
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'Patient name (required for prescription messages)',
    example: 'John Doe',
    required: false,
  })
  patient_name?: string;
}
