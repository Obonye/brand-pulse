import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SentimentService } from './sentiment.service';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';

@ApiTags('sentiment')
@ApiBearerAuth()
@UseGuards(TenantGuard)
@Controller('sentiment')
export class SentimentController {
  constructor(private readonly sentimentService: SentimentService) {}

  @Get('analysis')
  @ApiOperation({ summary: 'Get sentiment analyses for tenant' })
  @ApiResponse({ status: 200, description: 'Returns sentiment analyses' })
  async getSentimentAnalyses(
    @CurrentTenant() tenantId: string,
    @Query('limit') limit = 100,
    @Query('offset') offset = 0,
  ) {
    return this.sentimentService.findByTenantId(tenantId, limit, offset);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get sentiment statistics for tenant' })
  @ApiResponse({ status: 200, description: 'Returns sentiment statistics' })
  async getSentimentStats(
    @CurrentTenant() tenantId: string,
    @Query('brand_id') brandId?: string,
  ) {
    return this.sentimentService.getSentimentStats(tenantId, brandId);
  }
}