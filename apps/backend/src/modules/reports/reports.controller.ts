import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';

import { ReportsService } from './reports.service';
import {
  CreateReportDto,
  UpdateReportDto,
  ListReportsQueryDto,
} from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DeviceAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles, Permissions, Scope } from '../common/decorators/roles.decorator';
import { RbacGuard } from '../common/guards/rbac.guard';
import { UserPayload } from '../common/interfaces/user-payload.interface';

@ApiTags('Reports')
@Controller('api/v1/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('report:create')
  @ApiBearerAuth()
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Idempotency key for retry safety' })
  @ApiOperation({ summary: 'Create a new report (idempotent)' })
  @ApiResponse({ status: 201, description: 'Report created' })
  @ApiResponse({ status: 409, description: 'Idempotency conflict' })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createReport(
    @Body() dto: CreateReportDto,
    @CurrentUser() user: UserPayload,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    // Merge idempotency key from header if not in body
    if (idempotencyKey && !dto.idempotency_key) {
      dto.idempotency_key = idempotencyKey;
    }
    return this.reportsService.createReport(dto, user);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('report:read:own', 'report:read:scope')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List reports (scoped)' })
  @ApiResponse({ status: 200, description: 'Reports list with cursor' })
  async listReports(
    @Query() query: ListReportsQueryDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.reportsService.listReports(query, user);
  }

  @Get(':reportId')
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('report:read:own', 'report:read:scope')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get report detail' })
  @ApiResponse({ status: 200, description: 'Report detail' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async getReport(@Param('reportId') reportId: string, @CurrentUser() user: UserPayload) {
    return this.reportsService.getReport(reportId, user);
  }

  @Patch(':reportId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('report:create') // Reporter or org_admin
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update report (amend)' })
  @ApiResponse({ status: 200, description: 'Report updated' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  @ApiResponse({ status: 409, description: 'Version conflict' })
  async updateReport(
    @Param('reportId') reportId: string,
    @Body() dto: UpdateReportDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.reportsService.updateReport(reportId, dto, user);
  }

  @Post(':reportId/acknowledge')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RbacGuard)
  @Permissions('report:acknowledge')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Acknowledge report (operator/verifier)' })
  @ApiResponse({ status: 200, description: 'Report acknowledged' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async acknowledgeReport(
    @Param('reportId') reportId: string,
    @CurrentUser() user: UserPayload,
  ) {
    await this.reportsService.acknowledgeReport(reportId, user);
    return { message: 'Report acknowledged successfully' };
  }
}