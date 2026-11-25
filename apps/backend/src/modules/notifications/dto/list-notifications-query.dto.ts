import {
  IsOptional,
  IsString,
  IsIn,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by notification status',
    example: 'delivered',
    enum: ['pending', 'processing', 'delivered', 'read', 'failed'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['pending', 'processing', 'delivered', 'read', 'failed'])
  notification_status?: string;

  @ApiPropertyOptional({
    description: 'Filter by channel',
    example: 'in_app',
    enum: ['push', 'sms', 'email', 'in_app'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['push', 'sms', 'email', 'in_app'])
  channel?: string;

  @ApiPropertyOptional({
    description: 'Filter by creation date from (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsString()
  from_date?: string;

  @ApiPropertyOptional({
    description: 'Filter by creation date to (ISO 8601)',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsString()
  to_date?: string;

  @ApiPropertyOptional({
    description: 'Pagination cursor (base64 encoded)',
    example: 'eyJjcmVhdGVkX2F0IjoiMj...',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results (default 50, max 200)',
    example: 50,
    minimum: 1,
    maximum: 200,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  limit?: number;
}