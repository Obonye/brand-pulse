import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IndustriesService } from './industries.service';
import { IndustryResponseDto } from './dto/industry-response.dto';
import { LoggerService } from '../../common/logger/logger.service';

@ApiTags('Industries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('industries')
export class IndustriesController {
  private logger: ReturnType<LoggerService['setContext']>;

  constructor(
    private readonly industriesService: IndustriesService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.setContext('IndustriesController');
  }

  @Get()
  @ApiOperation({ summary: 'Get all active industries' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of active industries',
    type: [IndustryResponseDto]
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll() {
    this.logger.info('GET /industries - Fetch all industries');

    const industries = await this.industriesService.findAll();

    this.logger.info('GET /industries - Industries retrieved successfully', {
      count: industries.length
    });

    return industries;
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get industry statistics' })
  @ApiResponse({ status: 200, description: 'Industry statistics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStats() {
    this.logger.info('GET /industries/stats - Fetch industry statistics');

    const stats = await this.industriesService.getIndustryStats();

    this.logger.info('GET /industries/stats - Statistics retrieved successfully', {
      totalIndustries: stats.total_industries,
      activeIndustries: stats.active_industries,
      topIndustriesCount: stats.top_industries.length
    });

    return stats;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single industry by ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Industry details',
    type: IndustryResponseDto
  })
  @ApiResponse({ status: 404, description: 'Industry not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOne(@Param('id') id: string) {
    this.logger.info('GET /industries/:id - Fetch industry by ID', { industryId: id });

    const industry = await this.industriesService.findOne(id);

    if (!industry) {
      this.logger.warn('Industry not found', { industryId: id });
      return null;
    }

    this.logger.info('GET /industries/:id - Industry retrieved successfully', { industryId: id });

    return industry;
  }
}