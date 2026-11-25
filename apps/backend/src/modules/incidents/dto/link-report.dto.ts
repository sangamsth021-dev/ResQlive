import { IsString, IsUUID, IsIn, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LinkReportDto {
  @ApiProperty({
    description: 'Report ID to link',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsUUID()
  report_id: string;

  @ApiProperty({
    description: 'Relationship type',
    example: 'primary',
    enum: ['primary', 'supporting', 'duplicate', 'related'],
  })
  @IsString()
  @IsIn(['primary', 'supporting', 'duplicate', 'related'])
  relationship_type: string;

  @ApiPropertyOptional({
    description: 'Notes about the link',
    example: 'Primary report for this incident',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}