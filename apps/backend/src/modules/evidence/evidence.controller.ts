import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { EvidenceService } from './evidence.service';
import { CreateUploadSessionDto, CompleteUploadDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RbacGuard } from '../common/guards/rbac.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/roles.decorator';
import { UserPayload } from '../common/interfaces/user-payload.interface';

@ApiTags('Evidence')
@Controller('api/v1/reports/:reportId/evidence')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Post(':evidenceId/upload-session')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('evidence:upload')
  @ApiOperation({ summary: 'Create upload session for evidence' })
  @ApiResponse({ status: 201, description: 'Upload session created' })
  @ApiResponse({ status: 404, description: 'Evidence not found' })
  @ApiResponse({ status: 409, description: 'Upload already complete' })
  async createUploadSession(
    @Param('evidenceId') evidenceId: string,
    @CurrentUser() user: UserPayload,
  ) {
    return this.evidenceService.createUploadSession({ evidence_id: evidenceId }, user);
  }

  @Post(':evidenceId/complete')
  @HttpCode(HttpStatus.OK)
  @Permissions('evidence:upload')
  @ApiOperation({ summary: 'Complete evidence upload and queue for verification' })
  @ApiResponse({ status: 200, description: 'Upload completed, verification queued' })
  @ApiResponse({ status: 404, description: 'Evidence not found' })
  async completeUpload(
    @Param('evidenceId') evidenceId: string,
    @CurrentUser() user: UserPayload,
  ) {
    return this.evidenceService.completeUpload({ evidence_id: evidenceId }, user);
  }

  @Get(':evidenceId')
  @Permissions('evidence:upload', 'report:read:scope')
  @ApiOperation({ summary: 'Get evidence details' })
  @ApiResponse({ status: 200, description: 'Evidence details' })
  @ApiResponse({ status: 404, description: 'Evidence not found' })
  async getEvidence(
    @Param('evidenceId') evidenceId: string,
    @CurrentUser() user: UserPayload,
  ) {
    return this.evidenceService.getEvidence(evidenceId, user);
  }

  @Get(':evidenceId/download')
  @Permissions('evidence:upload', 'report:read:scope')
  @ApiOperation({ summary: 'Get presigned download URL for evidence' })
  @ApiResponse({ status: 200, description: 'Download URL' })
  @ApiResponse({ status: 404, description: 'Evidence not found' })
  @ApiResponse({ status: 400, description: 'Evidence not available' })
  async getDownloadUrl(
    @Param('evidenceId') evidenceId: string,
    @CurrentUser() user: UserPayload,
  ) {
    return this.evidenceService.getDownloadUrl(evidenceId, user);
  }
}