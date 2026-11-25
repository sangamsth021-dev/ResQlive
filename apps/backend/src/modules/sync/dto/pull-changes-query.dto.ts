import {
  IsOptional,
  IsString,
  IsNumber,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PullChangesQueryDto {
  @ApiProperty({
    description: 'Stream name to pull from',
    example: 'reports',
    enum: ['reports', 'incidents', 'assignments', 'evidence', 'authority-updates'],
  })
  @IsString()
  @IsIn(['reports', 'incidents', 'assignments', 'evidence', 'authority-updates'])
  stream: string;

  @ApiPropertyOptional({
    description: 'Pagination cursor (base64 encoded)',
    example: 'eyJjcmVhdGVkX2F0IjoiMj...',
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