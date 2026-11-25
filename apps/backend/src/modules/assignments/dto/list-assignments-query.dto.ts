import {
  IsOptional,
  IsString,
  IsUUID,
  IsIn,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListAssignmentsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by assignment status',
    example: 'assigned',
    enum: ['assigned', 'acknowledged', 'en_route', 'on_scene', 'working', 'completed', 'cancelled'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['assigned', 'acknowledged', 'en_route', 'on_scene', 'working', 'completed', 'cancelled'])
  assignment_status?: string;

  @ApiPropertyOptional({
    description: 'Filter by incident ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  incident_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by team ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  team_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by assignment date from (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsString()
  from_date?: string;

  @ApiPropertyOptional({
    description: 'Filter by assignment date to (ISO 8601)',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsString()
  to_date?: string;

  @ApiPropertyOptional({
    description: 'Pagination cursor (base64 encoded)',
    example: 'eyJhc3NpZ25lZF9hdCI6IjI...',
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