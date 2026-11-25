import {
  IsString,
  IsUUID,
  IsIn,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDeviceDto {
  @ApiProperty({
    description: 'Organization ID to register the device under',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsUUID()
  organization_id: string;

  @ApiProperty({
    description: 'Platform of the device',
    example: 'android',
    enum: ['android', 'ios', 'desktop', 'web'],
  })
  @IsString()
  @IsIn(['android', 'ios', 'desktop', 'web'])
  platform: string;

  @ApiProperty({
    description: 'Application version',
    example: '1.0.0',
  })
  @IsString()
  @MaxLength(50)
  app_version: string;

  @ApiProperty({
    description: 'Base64-encoded public key for device identity verification',
    example: 'LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0...',
  })
  @IsString()
  @MaxLength(2048)
  public_key: string;

  @ApiProperty({
    description: 'Key algorithm used',
    example: 'ECDSA_P256',
    enum: ['ECDSA_P256', 'RSA_2048', 'RSA_4096', 'ED25519'],
  })
  @IsString()
  @IsIn(['ECDSA_P256', 'RSA_2048', 'RSA_4096', 'ED25519'])
  key_algorithm: string;
}