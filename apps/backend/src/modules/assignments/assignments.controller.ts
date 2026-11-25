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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { AssignmentsService } from './assignments.service';
import {
  CreateAssignmentDto,
  UpdateAssignmentDto,
  ListAssignmentsQueryDto,
} from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RbacGuard } from '../common/guards/rbac.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/roles.decorator';
import { UserPayload } from '../common/interfaces/user-payload.interface';

@ApiTags('Assignments')
@Controller('api/v1/assignments')
@UseGuards(JwtAuthGuard, RbacGuard)
@ApiBearerAuth()
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('assignment:read:own') // team_lead or org_admin
  @ApiOperation({ summary: 'Create a new assignment' })
  @ApiResponse({ status: 201, description: 'Assignment created' })
  @ApiResponse({ status: 404, description: 'Incident or team not found' })
  @ApiResponse({ status: 409, description: 'Assignment already exists' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createAssignment(
    @Body() dto: CreateAssignmentDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.assignmentsService.createAssignment(dto, user);
  }

  @Get()
  @Permissions('assignment:read:own', 'incident:read:scope')
  @ApiOperation({ summary: 'List assignments (scoped)' })
  @ApiResponse({ status: 200, description: 'Assignments list with cursor' })
  async listAssignments(
    @Query() query: ListAssignmentsQueryDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.assignmentsService.listAssignments(query, user);
  }

  @Get(':assignmentId')
  @Permissions('assignment:read:own', 'incident:read:scope')
  @ApiOperation({ summary: 'Get assignment detail' })
  @ApiResponse({ status: 200, description: 'Assignment detail' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async getAssignment(@Param('assignmentId') assignmentId: string, @CurrentUser() user: UserPayload) {
    return this.assignmentsService.getAssignment(assignmentId, user);
  }

  @Patch(':assignmentId')
  @HttpCode(HttpStatus.OK)
  @Permissions('assignment:update:own') // team_lead or org_admin
  @ApiOperation({ summary: 'Update assignment (status transition, etc.)' })
  @ApiResponse({ status: 200, description: 'Assignment updated' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateAssignment(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: UpdateAssignmentDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.assignmentsService.updateAssignment(assignmentId, dto, user);
  }
}