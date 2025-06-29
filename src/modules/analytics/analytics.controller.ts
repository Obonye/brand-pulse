import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { AnalyticsQueryDto, BrandComparisonQueryDto, BasicAnalyticsQueryDto } from './dto/analytics-query.dto';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard analytics data (last 7 days)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns comprehensive dashboard data including summary, trends, and performance metrics'
  })
  async getDashboard(
    @CurrentTenant() tenantId: string,
    @Query() query: BasicAnalyticsQueryDto,
  ) {
    return this.analyticsService.getDashboardData(tenantId, query.brand_id);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get analytics summary' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns overall analytics summary with key metrics'
  })
  async getSummary(
    @CurrentTenant() tenantId: string,
    @Query() query: BasicAnalyticsQueryDto,
  ) {
    return this.analyticsService.getAnalyticsSummary(tenantId, {
      brandId: query.brand_id,
      dateFrom: query.date_from,
      dateTo: query.date_to,
    });
  }

  @Get('sentiment/trends')
  @ApiOperation({ summary: 'Get sentiment trends over time' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns sentiment trends data grouped by time period'
  })
  async getSentimentTrends(
    @CurrentTenant() tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getSentimentTrends(tenantId, {
      brandId: query.brand_id,
      sourceType: query.source_type,
      dateFrom: query.date_from,
      dateTo: query.date_to,
      interval: query.interval,
    });
  }

  @Get('mentions/volume')
  @ApiOperation({ summary: 'Get mention volume analytics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns mention volume data with trends and peak times'
  })
  async getMentionVolume(
    @CurrentTenant() tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getMentionVolumeAnalytics(tenantId, {
      brandId: query.brand_id,
      sourceType: query.source_type,
      dateFrom: query.date_from,
      dateTo: query.date_to,
      interval: query.interval,
    });
  }

  @Get('sources/performance')
  @ApiOperation({ summary: 'Get source performance metrics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns performance metrics for each source type'
  })
  async getSourcePerformance(
    @CurrentTenant() tenantId: string,
    @Query() query: BasicAnalyticsQueryDto,
  ) {
    return this.analyticsService.getSourcePerformance(tenantId, {
      brandId: query.brand_id,
      dateFrom: query.date_from,
      dateTo: query.date_to,
    });
  }

  @Get('brands/comparison')
  @ApiOperation({ summary: 'Compare sentiment across multiple brands' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns comparison data for multiple brands'
  })
  async getBrandComparison(
    @CurrentTenant() tenantId: string,
    @Query() query: BrandComparisonQueryDto,
  ) {
    return this.analyticsService.getBrandComparison(tenantId, {
      brandIds: query.brand_ids,
      dateFrom: query.date_from,
      dateTo: query.date_to,
    });
  }

  @Get('sentiment/distribution')
  @ApiOperation({ summary: 'Get sentiment distribution for a specific period' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns sentiment distribution with percentages'
  })
  async getSentimentDistribution(
    @CurrentTenant() tenantId: string,
    @Query() query: BasicAnalyticsQueryDto,
  ) {
    const summary = await this.analyticsService.getAnalyticsSummary(tenantId, {
      brandId: query.brand_id,
      dateFrom: query.date_from,
      dateTo: query.date_to,
    });

    const total = summary.total_mentions;
    return {
      total_mentions: total,
      distribution: {
        positive: {
          count: summary.total_positive,
          percentage: total > 0 ? Math.round((summary.total_positive / total) * 100 * 10) / 10 : 0
        },
        negative: {
          count: summary.total_negative,
          percentage: total > 0 ? Math.round((summary.total_negative / total) * 100 * 10) / 10 : 0
        },
        neutral: {
          count: summary.total_neutral,
          percentage: total > 0 ? Math.round((summary.total_neutral / total) * 100 * 10) / 10 : 0
        }
      },
      sentiment_score: summary.overall_sentiment_score,
      avg_confidence: summary.avg_confidence
    };
  }

  @Get('trends/growth')
  @ApiOperation({ summary: 'Get mention growth trends' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns growth trends compared to previous periods'
  })
  async getGrowthTrends(
    @CurrentTenant() tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    const volumeData = await this.analyticsService.getMentionVolumeAnalytics(tenantId, {
      brandId: query.brand_id,
      sourceType: query.source_type,
      dateFrom: query.date_from,
      dateTo: query.date_to,
      interval: query.interval || 'day',
    });

    return volumeData.map(item => ({
      period: item.period,
      mention_count: item.mention_count,
      trending_score: item.trending_score,
      growth_direction: item.trending_score > 0 ? 'up' : item.trending_score < 0 ? 'down' : 'stable'
    }));
  }
}