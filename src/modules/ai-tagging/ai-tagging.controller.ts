import { Controller, Get, Post, Body, Query, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { AITaggingService } from './ai-tagging.service';
import { TagFilterDto } from './dto/tag-filter.dto';
import { TagMentionDto } from './dto/tag-mention.dto';
import { BulkTagMentionsDto } from './dto/bulk-tag-mentions.dto';
import { LoggerService } from '../../common/logger/logger.service';

@ApiTags('AI Tagging')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('ai-tagging')
export class AITaggingController {
  private logger: ReturnType<LoggerService['setContext']>;

  constructor(
    private readonly aiTaggingService: AITaggingService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.setContext('AITaggingController');
  }

  @Post('tag-mention/:mentionId')
  @ApiOperation({ summary: 'Tag a single mention using AI' })
  @ApiResponse({ status: 201, description: 'Mention tagged successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async tagMention(
    @Param('mentionId') mentionId: string,
    @Query('industry_id') industryId: string,
    @CurrentTenant() tenantId: string,
  ) {
    this.logger.info('POST /ai-tagging/tag-mention/:mentionId - Tag single mention', {
      tenantId,
      mentionId,
      industryId
    });

    const taggingResult = await this.aiTaggingService.tagMention(mentionId, tenantId, industryId);
    const mentionTag = await this.aiTaggingService.storeMentionTag(taggingResult, tenantId);

    this.logger.info('Mention tagged successfully', {
      tenantId,
      mentionId,
      tagId: mentionTag.id,
      category: taggingResult.category,
      intent: taggingResult.intent
    });

    return {
      mention_tag: mentionTag,
      tagging_result: taggingResult
    };
  }

  @Post('bulk-tag')
  @ApiOperation({ summary: 'Tag multiple mentions using AI in bulk' })
  @ApiResponse({ status: 201, description: 'Bulk tagging completed' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async bulkTagMentions(
    @Body() bulkTagDto: BulkTagMentionsDto,
    @CurrentTenant() tenantId: string,
  ) {
    this.logger.info('POST /ai-tagging/bulk-tag - Bulk tag mentions', {
      tenantId,
      mentionCount: bulkTagDto.mention_ids.length,
      brandId: bulkTagDto.brand_id,
      industryId: bulkTagDto.industry_id,
      forceRetag: bulkTagDto.force_retag
    });

    const result = await this.aiTaggingService.bulkTagMentions(
      bulkTagDto.mention_ids,
      tenantId,
      bulkTagDto.industry_id,
      bulkTagDto.force_retag
    );

    this.logger.info('Bulk tagging completed', {
      tenantId,
      totalProcessed: bulkTagDto.mention_ids.length,
      successful: result.success,
      failed: result.failed,
      successRate: Math.round((result.success / bulkTagDto.mention_ids.length) * 100)
    });

    return result;
  }

  @Get('mention-tags')
  @ApiOperation({ summary: 'Get mention tags with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'List of mention tags' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMentionTags(
    @Query() filter: TagFilterDto,
    @CurrentTenant() tenantId: string,
  ) {
    this.logger.info('GET /ai-tagging/mention-tags - Fetch mention tags', {
      tenantId,
      filters: {
        mentionId: filter.mention_id,
        categoryId: filter.category_id,
        intentId: filter.intent_id,
        priority: filter.priority,
        hasDateRange: !!(filter.start_date || filter.end_date),
        hasTopics: !!(filter.topics?.length)
      },
      pagination: {
        limit: filter.limit,
        offset: filter.offset
      }
    });

    const result = await this.aiTaggingService.getMentionTags(filter, tenantId);

    this.logger.info('Mention tags retrieved successfully', {
      tenantId,
      totalRecords: result.total,
      returnedRecords: result.data.length
    });

    return result;
  }
}