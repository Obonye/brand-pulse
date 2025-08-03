import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SentimentService } from './sentiment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { LoggerService } from '../../common/logger/logger.service';

@ApiTags('sentiment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('sentiment')
export class SentimentController {
  private logger: ReturnType<LoggerService['setContext']>;

  constructor(
    private readonly sentimentService: SentimentService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.setContext('SentimentController');
  }

  @Get('analysis')
  @ApiOperation({ summary: 'Get sentiment analyses for tenant' })
  @ApiResponse({ status: 200, description: 'Returns sentiment analyses' })
  async getSentimentAnalyses(
    @CurrentTenant() tenantId: string,
    @Query('limit') limit = 100,
    @Query('offset') offset = 0,
  ) {
    this.logger.info('GET /sentiment/analysis - Fetch sentiment analyses', {
      tenantId,
      limit,
      offset
    });

    const result = await this.sentimentService.findByTenantId(tenantId, limit, offset);
    
    this.logger.info('GET /sentiment/analysis - Analyses retrieved successfully', {
      tenantId,
      count: result.length,
      limit,
      offset
    });

    return result;
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get sentiment statistics for tenant' })
  @ApiResponse({ status: 200, description: 'Returns sentiment statistics' })
  async getSentimentStats(
    @CurrentTenant() tenantId: string,
    @Query('brand_id') brandId?: string,
  ) {
    this.logger.info('GET /sentiment/stats - Fetch sentiment statistics', {
      tenantId,
      brandId,
      hasBrandFilter: !!brandId
    });

    const result = await this.sentimentService.getSentimentStats(tenantId, brandId);
    
    this.logger.info('GET /sentiment/stats - Statistics retrieved successfully', {
      tenantId,
      brandId,
      stats: {
        total: result.total,
        positive: result.positive,
        negative: result.negative,
        neutral: result.neutral,
        averageConfidence: result.average_confidence
      }
    });

    return result;
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get sentiment trends over time' })
  @ApiResponse({ status: 200, description: 'Returns sentiment trends data' })
  async getSentimentTrends(
    @CurrentTenant() tenantId: string,
    @Query('brand_id') brandId?: string,
    @Query('interval') interval: 'day' | 'week' | 'month' = 'day',
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    this.logger.info('GET /sentiment/trends - Fetch sentiment trends', {
      tenantId,
      brandId,
      interval,
      dateFrom,
      dateTo,
      hasBrandFilter: !!brandId,
      hasDateRange: !!(dateFrom || dateTo)
    });

    const result = await this.sentimentService.getSentimentTrends(tenantId, brandId, interval, dateFrom, dateTo);
    
    this.logger.info('GET /sentiment/trends - Trends retrieved successfully', {
      tenantId,
      brandId,
      interval,
      dataPoints: result.length,
      dateRange: { from: dateFrom, to: dateTo }
    });

    return result;
  }
}