import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { ScrapedPostsService } from './scraped-posts.service';
import { ScrapedPostsQueryDto } from './dto/scraped-posts-query.dto';
import { LoggerService } from '../../common/logger/logger.service';

@ApiTags('Scraped Posts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('scraped-posts')
export class ScrapedPostsController {
  private logger: ReturnType<LoggerService['setContext']>;

  constructor(
    private readonly scrapedPostsService: ScrapedPostsService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.setContext('ScrapedPostsController');
  }

  @Get()
  @ApiOperation({ summary: 'Get scraped posts with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'List of scraped posts' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getScrapedPosts(
    @Query() query: ScrapedPostsQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    this.logger.info('GET /scraped-posts - Fetch scraped posts', {
      tenantId,
      filters: {
        brandId: query.brand_id,
        sourceType: query.source_type,
        postType: query.post_type,
        hasDateRange: !!(query.start_date || query.end_date)
      },
      pagination: {
        limit: query.limit || 20,
        offset: query.offset || 0
      }
    });

    const result = await this.scrapedPostsService.getScrapedPosts(tenantId, query);

    this.logger.info('GET /scraped-posts - Posts retrieved successfully', {
      tenantId,
      totalRecords: result.total,
      returnedRecords: result.data.length,
      hasFilters: !!(query.brand_id || query.source_type || query.post_type || query.start_date || query.end_date)
    });

    return result;
  }

  @Get('by-brand/:brandId')
  @ApiOperation({ summary: 'Get scraped posts for a specific brand' })
  @ApiResponse({ status: 200, description: 'List of scraped posts for the brand' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getScrapedPostsByBrand(
    @Param('brandId') brandId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.scrapedPostsService.getScrapedPostsByBrand(brandId, tenantId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get scraped posts statistics' })
  @ApiResponse({ status: 200, description: 'Scraped posts statistics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getScrapedPostsStats(
    @Query() query: ScrapedPostsQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    this.logger.info('GET /scraped-posts/stats - Fetch scraped posts statistics', {
      tenantId,
      filters: {
        brandId: query.brand_id,
        sourceType: query.source_type,
        hasDateRange: !!(query.start_date || query.end_date)
      }
    });

    const result = await this.scrapedPostsService.getScrapedPostsStats(tenantId, query);

    this.logger.info('GET /scraped-posts/stats - Statistics retrieved successfully', {
      tenantId,
      stats: {
        totalPosts: result.total_posts,
        sourceTypes: Object.keys(result.by_source).length,
        postTypes: Object.keys(result.by_post_type).length,
        totalLikes: result.engagement_stats.total_likes,
        totalComments: result.engagement_stats.total_comments
      }
    });

    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single scraped post by ID' })
  @ApiResponse({ status: 200, description: 'Scraped post details' })
  @ApiResponse({ status: 404, description: 'Scraped post not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getScrapedPostById(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.scrapedPostsService.getScrapedPostById(id, tenantId);
  }
}