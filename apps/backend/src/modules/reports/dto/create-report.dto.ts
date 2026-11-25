import {
  IsString,
  IsUUID,
  IsOptional,
  IsObject,
  IsNumber,
  IsArray,
  ValidateNested,
  IsIn,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EvidenceItemDto {
  @ApiProperty({
    description: 'Client-generated UUID v4 for this evidence item',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsString()
  @IsUUID('4')
  evidence_id: string;

  @ApiProperty({
    description: 'Evidence kind',
    example: 'photo',
    enum: ['photo', 'video', 'audio', 'document'],
  })
  @IsString()
  @IsIn(['photo', 'video', 'audio', 'document'])
  kind: string;

  @ApiProperty({
    description: 'MIME type of the evidence',
    example: 'image/jpeg',
  })
  @IsString()
  @MaxLength(100)
  mime_type: string;

  @ApiProperty({
    description: 'Size in bytes',
    example: 1048576,
  })
  @IsNumber()
  size_bytes: number;

  @ApiProperty({
    description: 'SHA-256 hash of the evidence file (hex)',
    example: 'a1b2c3d4e5f6...',
  })
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i)
  sha256_hash: string;

  @ApiPropertyOptional({
    description: 'Capture metadata',
    type: 'object',
  })
  @IsOptional()
  @IsObject()
  capture_metadata_json?: Record<string, any>;
}

export class LocationGeoDto {
  @ApiProperty({
    description: 'GeoJSON Point geometry',
    example: { type: 'Point', coordinates: [-122.4194, 37.7749] },
  })
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  location_geom: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
}

export class CreateReportDto {
  @ApiProperty({
    description: 'Client-generated UUID v4 for this report',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsUUID('4')
  report_id: string;

  @ApiPropertyOptional({
    description: 'Idempotency key for retry safety',
    example: 'idem-550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotency_key?: string;

  @ApiPropertyOptional({
    description: 'Organization ID (defaults to user\'s primary organization)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  organization_id?: string;

  @ApiProperty({
    description: 'Report category code',
    example: 'fire',
  })
  @IsString()
  @MaxLength(50)
  category_code: string;

  @ApiProperty({
    description: 'Severity level code',
    example: 'high',
  })
  @IsString()
  @MaxLength(50)
  severity_code: string;

  @ApiPropertyOptional({
    description: 'Structured impact data',
    type: 'object',
  })
  @IsOptional()
  @IsObject()
  impact_json?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Location as GeoJSON Point',
    type: LocationGeoDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationGeoDto)
  location_geom?: LocationGeoDto;

  @ApiPropertyOptional({
    description: 'Location accuracy in meters',
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  location_accuracy_m?: number;

  @ApiPropertyOptional({
    description: 'Location source',
    example: 'gps',
    enum: ['gps', 'manual', 'cell_tower', 'wifi'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['gps', 'manual', 'cell_tower', 'wifi'])
  location_source?: string;

  @ApiPropertyOptional({
    description: 'Capture started timestamp (ISO 8601)',
    example: '2024-01-15T10:30:00Z',
  })
  @IsOptional()
  @IsString()
  capture_started_at?: string;

  @ApiPropertyOptional({
    description: 'Capture completed timestamp (ISO 8601)',
    example: '2024-01-15T10:35:00Z',
  })
  @IsOptional()
  @IsString()
  capture_completed_at?: string;

  @ApiPropertyOptional({
    description: 'Device timezone',
    example: 'America/Los_Angeles',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  device_timezone?: string;

  @ApiPropertyOptional({
    description: 'Device OS',
    example: 'Android 14',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  device_os?: string;

  @ApiPropertyOptional({
    description: 'App version',
    example: '1.0.0',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  app_version?: string;

  @ApiPropertyOptional({
    description: 'Evidence items',
    type: [EvidenceItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvidenceItemDto)
  evidence?: EvidenceItemDto[];
}