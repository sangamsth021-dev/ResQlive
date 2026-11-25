import {
  IsOptional,
  IsString,
  IsIn,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAssignmentDto {
  @ApiPropertyOptional({
    description: 'Assignment status',
    example: 'acknowledged',
    enum: ['assigned', 'acknowledged', 'en_route', 'on_scene', 'working', 'completed', 'cancelled'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['assigned', 'acknowledged', 'en_route', 'on_scene', 'working', 'completed', 'cancelled'])
  assignment_status?: string;

  @ApiPropertyOptional({
    description: 'Role of this team on the incident',
    example: 'primary_attack',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  role_on_incident?: string;

  @ApiPropertyOptional({
    description: 'Instructions for the assignment',
    example: 'Updated instructions',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string;

  @ApiPropertyOptional({
    description: 'Notes from the team',
    example: 'Arrived on scene, establishing command',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Reason for status change',
    example: 'Team acknowledged assignment',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}