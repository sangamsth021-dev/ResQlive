import {
  IsOptional,
  IsString,
  IsNumber,
  IsIn,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LocationGeoDto } from './create-incident.dto';

export class UpdateIncidentDto {
  @ApiPropertyOptional({
    description: 'Expected version for optimistic locking',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  expected_version?: number;

  @ApiPropertyOptional({
    description: 'Incident status',
    example: 'verified',
    enum: ['new', 'triaged', 'verified', 'assigned', 'dispatched', 'response_in_progress', 'resolved', 'closed', 'rejected'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['new', 'triaged', 'verified', 'assigned', 'dispatched', 'response_in_progress', 'resolved', 'closed', 'rejected'])
  incident_status?: string;

  @ApiPropertyOptional({
    description: 'Priority level code',
    example: 'critical',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  priority_code?: string;

  @ApiPropertyOptional({
    description: 'Incident title',
    example: 'Updated: Structure Fire at 123 Main St',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    description: 'Incident description',
    example: 'Updated description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Location as GeoJSON Point',
    type: LocationGeoDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationGeoDto)
  location_geom?: LocationGeoDto;

  @ApiPropertyOptional({
    description: 'Reason for status change',
    example: 'Verified by on-scene commander',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}