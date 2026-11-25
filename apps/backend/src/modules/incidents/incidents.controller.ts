import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { IncidentsService } from './incidents.service';
import {
  CreateIncidentDto,
  UpdateIncidentDto,
  LinkReportDto,
  ListIncidentsQueryDto,
} from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RbacGuard } from '../common/guards/rbac.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions, Scope } from '../common/decorators/roles.decorator';
import { UserPayload } from '../common/interfaces/user-payload.interface';

@ApiTags('Incidents')
@Controller('api/v1/incidents')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('incident:create')
  @ApiOperation({ summary: 'Create a new incident' })
  @ApiResponse({ status: 201, description: 'Incident created' })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createIncident(
    @Body() dto: CreateIncidentDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.incidentsService.createIncident(dto, user);
  }

  @Get()
  @Permissions('incident:read:scope')
  @ApiOperation({ summary: 'List incidents (scoped)' })
  @ApiResponse({ status: 200, description: 'Incidents list with cursor' })
  async listIncidents(
    @Query() query: ListIncidentsQueryDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.incidentsService.listIncidents(query, user);
  }

  @Get(':incidentId')
  @Permissions('incident:read:scope')
  @ApiOperation({ summary: 'Get incident detail' })
  @ApiResponse({ status: 200, description: 'Incident detail' })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  async getIncident(@Param('incidentId') incidentId: string, @CurrentUser() user: UserPayload) {
    return this.incidentsService.getIncident(incidentId, user);
  }

  @Patch(':incidentId')
  @HttpCode(HttpStatus.OK)
  @Permissions('incident:create') // Verifier or org_admin
  @ApiOperation({ summary: 'Update incident (status transition, etc.)' })
  @ApiResponse({ status: 200, description: 'Incident updated' })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  @ApiResponse({ status: 409, description: 'Version conflict' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  async updateIncident(
    @Param('incidentId') incidentId: string,
    @Body() dto: UpdateIncidentDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.incidentsService.updateIncident(incidentId, dto, user);
  }

  @Post(':incidentId/reports')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('incident:create')
  @ApiOperation({ summary: 'Link a report to this incident' })
  @ApiResponse({ status: 201, description: 'Report linked' })
  @ApiResponse({ status: 404, description: 'Incident or report not found' })
  @ApiResponse({ status: 409, description: 'Already linked' })
  async linkReport(
    @Param('incidentId') incidentId: string,
    @Body() dto: LinkReportDto,
    @CurrentUser() user: UserPayload,
  ) {
    await this.incidentsService.linkReport(incidentId, dto, user);
    return { message: 'Report linked successfully' };
  }

  @Delete(':incidentId/reports/:reportId')
  @HttpCode(HttpStatus.OK)
  @Permissions('incident:create')
  @ApiOperation({ summary: 'Unlink a report from this incident' })
  @ApiResponse({ status: 200, description: 'Report unlinked' })
  @ApiResponse({ status: 404, description: 'Link not found' })
  async unlinkReport(
    @Param('incidentId') incidentId: string,
    @Param('reportId') reportId: string,
    @CurrentUser() user: UserPayload,
  ) {
    await this.incidentsService.unlinkReport(incidentId, reportId, user);
    return { message: 'Report unlinked successfully' };
  }
}