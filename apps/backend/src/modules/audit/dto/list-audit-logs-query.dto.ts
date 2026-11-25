import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListAuditLogsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by action (partial match)',
    example: 'report',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @ApiPropertyOptional({
    description: 'Filter by target type',
    example: 'REPORT',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  target_type?: string;

  @ApiPropertyOptional({
    description: 'Filter by target ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  target_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by actor user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  actor_user_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by actor role',
    example: 'verifier',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  actor_role?: string;

  @ApiPropertyOptional({
    description: 'Filter by date from (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsString()
  from_date?: string;

  @ApiPropertyOptional({
    description: 'Filter by date to (ISO 8601)',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsString()
  to_date?: string;

  @ApiPropertyOptional({
    description: 'Pagination cursor (base64 encoded)',
    example: 'eyJvY2N1cnJlZF9hdCI6IjI...',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results (default 100, max 500)',
    example: 100,
    minimum: 1,
    maximum: 500,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  limit?: number;
}