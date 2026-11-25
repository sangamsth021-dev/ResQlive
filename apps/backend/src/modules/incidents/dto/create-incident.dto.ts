import {
  IsString,
  IsOptional,
  IsObject,
  ValidateNested,
  IsIn,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
    coordinates: [number, number];
  };
}

export class CreateIncidentDto {
  @ApiProperty({
    description: 'Priority level code',
    example: 'high',
  })
  @IsString()
  @MaxLength(50)
  priority_code: string;

  @ApiPropertyOptional({
    description: 'Incident type code',
    example: 'fire_structure',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  incident_type_code?: string;

  @ApiPropertyOptional({
    description: 'Jurisdiction organization ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  jurisdiction_organization_id?: string;

  @ApiProperty({
    description: 'Incident title',
    example: 'Structure Fire at 123 Main St',
  })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({
    description: 'Incident description',
    example: 'Two-story residential structure fire with reported entrapment',
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
}