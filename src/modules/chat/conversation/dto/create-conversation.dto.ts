import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateConversationDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'The id of the creator',
  })
  creator_id: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    description: 'The id of the participant',
  })
  participant_id: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description:
      'The id of the broadcast (if conversation is created from a broadcast)',
    required: false,
    example: 'clx1234567890abcdef',
  })
  broadcast_id?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'The type of conversation',
    enum: ['patient_doctor', 'doctor_shop_owner'],
    default: 'patient_doctor',
    required: false,
  })
  type?: string;
}
