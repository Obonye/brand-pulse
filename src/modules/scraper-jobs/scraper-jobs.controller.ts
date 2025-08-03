// src/modules/scraper-jobs/scraper-jobs.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpStatus,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ScraperJobsService } from './scraper-jobs.service';
import { CreateScraperJobDto } from './dto/create-scraper-job.dto';
import { UpdateScraperJobDto } from './dto/update-scraper-job.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { LoggerService } from '../../common/logger/logger.service';

@ApiTags('Scraper Jobs')
@ApiBearerAuth()
@Controller('scraper-jobs')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ScraperJobsController {
  private logger: ReturnType<LoggerService['setContext']>;

  constructor(
    private readonly scraperJobsService: ScraperJobsService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.setContext('ScraperJobsController');
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Create new scraper job' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Scraper job created successfully',
  })
  async create(
    @Body() createScraperJobDto: CreateScraperJobDto,
    @CurrentTenant() tenantId: string,
  ) {
    this.logger.info('POST /scraper-jobs - Create scraper job request', { 
      jobName: createScraperJobDto.name,
      sourceType: createScraperJobDto.source_type,
      brandId: createScraperJobDto.brand_id,
      tenantId 
    });

    const job = await this.scraperJobsService.create(createScraperJobDto, tenantId);
    
    this.logger.info('POST /scraper-jobs - Scraper job created successfully', { 
      jobId: job.id,
      jobName: job.name,
      sourceType: job.source_type,
      tenantId 
    });

    return {
      message: 'Scraper job created successfully',
      job,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all scraper jobs' })
  @ApiQuery({ name: 'brand_id', required: false, description: 'Filter by brand ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Scraper jobs retrieved successfully',
  })
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query('brand_id') brandId?: string,
  ) {
    const jobs = await this.scraperJobsService.findAll(tenantId, brandId);
    return {
      jobs,
      total: jobs.length,
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get scraper job statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statistics retrieved successfully',
  })
  async getStats(@CurrentTenant() tenantId: string) {
    const stats = await this.scraperJobsService.getJobStats(tenantId);
    return {
      stats,
    };
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Scraper job UUID' })
  @ApiOperation({ summary: 'Get scraper job by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Scraper job retrieved successfully',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const job = await this.scraperJobsService.findOne(id, tenantId);
    return {
      job,
    };
  }

  @Get(':id/runs')
  @ApiParam({ name: 'id', description: 'Scraper job UUID' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({ summary: 'Get scraper job run history' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job runs retrieved successfully',
  })
  async getJobRuns(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
    @Query('limit') limit?: number,
  ) {
    const runs = await this.scraperJobsService.getJobRuns(id, tenantId, limit || 10);
    return {
      runs,
      total: runs.length,
    };
  }

  @Post(':id/trigger')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  @ApiParam({ name: 'id', description: 'Scraper job UUID' })
  @ApiOperation({ summary: 'Manually trigger scraper job' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job triggered successfully',
  })
  async triggerJob(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ) {
    this.logger.info('POST /scraper-jobs/:id/trigger - Trigger job request', { 
      jobId: id,
      tenantId 
    });

    const run = await this.scraperJobsService.triggerJob(id, tenantId);
    
    this.logger.info('POST /scraper-jobs/:id/trigger - Job triggered successfully', { 
      jobId: id,
      runId: run.id,
      apifyRunId: run.apify_run_id,
      tenantId 
    });

    return {
      message: 'Scraper job triggered successfully',
      run,
    };
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  @ApiParam({ name: 'id', description: 'Scraper job UUID' })
  @ApiOperation({ summary: 'Update scraper job' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Scraper job updated successfully',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateScraperJobDto: UpdateScraperJobDto,
    @CurrentTenant() tenantId: string,
  ) {
    const job = await this.scraperJobsService.update(id, updateScraperJobDto, tenantId);
    return {
      message: 'Scraper job updated successfully',
      job,
    };
  }

  @Patch(':id/toggle')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  @ApiParam({ name: 'id', description: 'Scraper job UUID' })
  @ApiOperation({ summary: 'Toggle scraper job active status' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Scraper job status toggled successfully',
  })
  async toggleActive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ) {
    this.logger.info('PATCH /scraper-jobs/:id/toggle - Toggle job status request', { 
      jobId: id,
      tenantId 
    });

    const job = await this.scraperJobsService.toggleActive(id, tenantId);
    
    this.logger.info('PATCH /scraper-jobs/:id/toggle - Job status toggled successfully', { 
      jobId: id,
      jobName: job.name,
      newStatus: job.is_active ? 'active' : 'inactive',
      tenantId 
    });

    return {
      message: `Scraper job ${job.is_active ? 'activated' : 'deactivated'} successfully`,
      job,
    };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('owner', 'admin')
  @ApiParam({ name: 'id', description: 'Scraper job UUID' })
  @ApiOperation({ summary: 'Delete scraper job' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Scraper job deleted successfully',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenantId: string,
  ) {
    await this.scraperJobsService.remove(id, tenantId);
    return {
      message: 'Scraper job deleted successfully',
    };
  }
}