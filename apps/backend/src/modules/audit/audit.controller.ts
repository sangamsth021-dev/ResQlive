import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { AuditService } from './audit.service';
import { ListAuditLogsQueryDto, ExportAuditLogsDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RbacGuard } from '../common/guards/rbac.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/roles.decorator';
import { UserPayload } from '../common/interfaces/user-payload.interface';

@ApiTags('Audit')
@Controller('api/v1/audit')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permissions('audit:read')
  @ApiOperation({ summary: 'List audit logs (org_admin or audit permission)' })
  @ApiResponse({ status: 200, description: 'Audit logs with cursor' })
  async listAuditLogs(
    @Query() query: ListAuditLogsQueryDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.auditService.listAuditLogs(query, user);
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  @Permissions('audit:export')
  @ApiOperation({ summary: 'Export audit logs (org_admin or audit export permission)' })
  @ApiResponse({ status: 200, description: 'Export result with download URL' })
  async exportAuditLogs(
    @Body() dto: ExportAuditLogsDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.auditService.exportAuditLogs(dto, user);
  }
}