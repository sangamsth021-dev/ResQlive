import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUploadSessionDto {
  @ApiProperty({
    description: 'Evidence ID to create upload session for',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsString()
  @IsUUID()
  evidence_id: string;
}