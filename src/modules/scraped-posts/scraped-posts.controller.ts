import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { ScrapedPostsService } from './scraped-posts.service';
import { ScrapedPostsQueryDto } from './dto/scraped-posts-query.dto';

@ApiTags('Scraped Posts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('scraped-posts')
export class ScrapedPostsController {
  constructor(private readonly scrapedPostsService: ScrapedPostsService) {}

  @Get()
  @ApiOperation({ summary: 'Get scraped posts with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'List of scraped posts' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getScrapedPosts(
    @Query() query: ScrapedPostsQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.scrapedPostsService.getScrapedPosts(tenantId, query);
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
    return this.scrapedPostsService.getScrapedPostsStats(tenantId, query);
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