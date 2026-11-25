import {
  IsString,
  IsUUID,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAssignmentDto {
  @ApiProperty({
    description: 'Incident ID to assign team to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsUUID()
  incident_id: string;

  @ApiProperty({
    description: 'Response team ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsString()
  @IsUUID()
  team_id: string;

  @ApiPropertyOptional({
    description: 'Role of this team on the incident',
    example: 'primary_attack',
    enum: ['incident_command', 'primary_attack', 'search_rescue', 'ventilation', 'water_supply', 'medical', 'rehab', 'safety', 'liaison', 'responder'],
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  role_on_incident?: string;

  @ApiPropertyOptional({
    description: 'Instructions for the assignment',
    example: 'Establish water supply and protect exposures',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string;
}