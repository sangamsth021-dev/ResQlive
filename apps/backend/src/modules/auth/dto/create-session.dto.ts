import {
  IsString,
  IsOptional,
  IsPhoneNumber,
  IsEmail,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSessionDto {
  @ApiPropertyOptional({
    description: 'Phone number in E.164 format (e.g., +15551234567)',
    example: '+15551234567',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone must be in E.164 format (e.g., +15551234567)',
  })
  phone_e164?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiProperty({
    description: 'Password',
    example: 'securePassword123',
  })
  @IsString()
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({
    description: 'Device ID for this session',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  device_id?: string;
}