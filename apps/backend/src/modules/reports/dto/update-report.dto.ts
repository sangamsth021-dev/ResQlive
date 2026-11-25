import {
  IsOptional,
  IsObject,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LocationGeoDto } from './create-report.dto';

export class UpdateReportDto {
  @ApiPropertyOptional({
    description: 'Expected version for optimistic locking',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  expected_version?: number;

  @ApiPropertyOptional({
    description: 'Updated structured impact data',
    type: 'object',
  })
  @IsOptional()
  @IsObject()
  impact_json?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Updated location as GeoJSON Point',
    type: LocationGeoDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationGeoDto)
  location_geom?: LocationGeoDto;

  @ApiPropertyOptional({
    description: 'Updated location accuracy in meters',
    example: 5,
  })
  @IsOptional()
  @IsNumber()
  location_accuracy_m?: number;
}