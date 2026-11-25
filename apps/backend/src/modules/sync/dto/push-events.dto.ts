import {
  IsArray,
  ValidateNested,
  IsString,
  IsNumber,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SyncEventDto {
  @ApiProperty({
    description: 'Event UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  event_id: string;

  @ApiProperty({
    description: 'Stream name (e.g., reports, incidents)',
    example: 'reports',
  })
  @IsString()
  stream_name: string;

  @ApiProperty({
    description: 'Aggregate type',
    example: 'REPORT',
    enum: ['REPORT', 'INCIDENT', 'ASSIGNMENT', 'EVIDENCE'],
  })
  @IsString()
  aggregate_type: string;

  @ApiProperty({
    description: 'Aggregate ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  aggregate_id: string;

  @ApiProperty({
    description: 'Event type',
    example: 'REPORT_SUBMITTED',
  })
  @IsString()
  event_type: string;

  @ApiProperty({
    description: 'Schema version',
    example: 1,
  })
  @IsNumber()
  schema_version: number;

  @ApiProperty({
    description: 'Event timestamp on device (ISO 8601)',
    example: '2024-01-15T10:30:00Z',
  })
  @IsString()
  occurred_at_device: string;

  @ApiProperty({
    description: 'SHA-256 hash of payload',
    example: 'a1b2c3d4e5f6...',
  })
  @IsString()
  payload_hash: string;

  @ApiProperty({
    description: 'Event payload',
    type: 'object',
  })
  @IsObject()
  payload: Record<string, any>;
}

export class PushEventsDto {
  @ApiProperty({
    description: 'Origin node ID',
    example: 'device-550e8400-e29b-41d4-a716-446655440001',
  })
  @IsString()
  origin_node_id: string;

  @ApiProperty({
    description: 'Array of events to push',
    type: [SyncEventDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncEventDto)
  events: SyncEventDto[];
}