import {
  IsString,
  IsUUID,
  IsOptional,
  IsIn,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty({
    description: 'User ID to notify',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsUUID()
  user_id: string;

  @ApiProperty({
    description: 'Notification channel',
    example: 'in_app',
    enum: ['push', 'sms', 'email', 'in_app'],
  })
  @IsString()
  @IsIn(['push', 'sms', 'email', 'in_app'])
  channel: string;

  @ApiProperty({
    description: 'Template code',
    example: 'report_acknowledged',
  })
  @IsString()
  @MaxLength(100)
  template_code: string;

  @ApiPropertyOptional({
    description: 'Template data for rendering',
    type: 'object',
  })
  @IsOptional()
  @IsObject()
  template_data_json?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Priority',
    example: 'normal',
    enum: ['low', 'normal', 'high', 'critical'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['low', 'normal', 'high', 'critical'])
  priority?: string;

  @ApiPropertyOptional({
    description: 'Related entity type',
    example: 'REPORT',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  related_type?: string;

  @ApiPropertyOptional({
    description: 'Related entity ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  related_id?: string;

  @ApiPropertyOptional({
    description: 'Scheduled delivery time (ISO 8601)',
    example: '2024-01-15T10:30:00Z',
  })
  @IsOptional()
  @IsString()
  scheduled_for?: string;
}