import {
  IsOptional,
  IsString,
  IsNumber,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListReportsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by category code',
    example: 'fire',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category_code?: string;

  @ApiPropertyOptional({
    description: 'Filter by severity code',
    example: 'high',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  severity_code?: string;

  @ApiPropertyOptional({
    description: 'Filter by report status',
    example: 'submitted',
    enum: ['submitted', 'acknowledged', 'verified', 'rejected', 'closed'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['submitted', 'acknowledged', 'verified', 'rejected', 'closed'])
  report_status?: string;

  @ApiPropertyOptional({
    description: 'Filter by organization ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  organization_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by reporter user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  reporter_user_id?: string;

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
    description: 'Filter by bounding box: minLon,minLat,maxLon,maxLat',
    example: '-122.5,37.7,-122.3,37.8',
  })
  @IsOptional()
  @IsString()
  bbox?: string;

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