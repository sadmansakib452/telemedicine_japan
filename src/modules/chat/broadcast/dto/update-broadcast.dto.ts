import { PartialType } from '@nestjs/swagger';
import { CreateBroadcastDto } from './create-broadcast.dto';
import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for updating a broadcast
 * Used to update broadcast status (e.g., when a doctor responds)
 */
export class UpdateBroadcastDto extends PartialType(CreateBroadcastDto) {
  @IsOptional()
  @IsString()
  @IsIn(['open', 'assisted', 'closed'], {
    message: 'Status must be one of: open, assisted, closed',
  })
  @ApiProperty({
    description: 'The status of the broadcast',
    enum: ['open', 'assisted', 'closed'],
    example: 'assisted',
    required: false,
  })
  status?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'The ID of the doctor who assisted (responded first)',
    example: 'clx9876543210fedcba',
    required: false,
  })
  assisted_by?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'The ID of the conversation created when doctor responds',
    example: 'clx5555555555555555',
    required: false,
  })
  conversation_id?: string;
}
