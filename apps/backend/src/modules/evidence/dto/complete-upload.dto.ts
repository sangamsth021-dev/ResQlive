import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteUploadDto {
  @ApiProperty({
    description: 'Evidence ID to complete upload for',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsString()
  @IsUUID()
  evidence_id: string;
}