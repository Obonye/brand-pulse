import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { MentionsService } from './mentions.service';
import { GetMentionsTableQueryDto, MentionsTableResponseDto } from './dto/mentions-table.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { ApiBearerAuth } from '@nestjs/swagger';
import { LoggerService } from '../../common/logger/logger.service';

@Controller('mentions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
export class MentionsController {
  private logger: ReturnType<LoggerService['setContext']>;

  constructor(
    private readonly mentionsService: MentionsService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.setContext('MentionsController');
  }

  @Get('table')
  async getTableData(
    @CurrentTenant() tenantId: string,
    @Query() query: GetMentionsTableQueryDto,
  ): Promise<MentionsTableResponseDto> {
    this.logger.info('GET /mentions/table - Fetch mentions table data', {
      tenantId,
      filters: {
        page: query.page,
        limit: query.limit,
        brandId: query.brand_id,
        sourceType: query.source_type,
        sentiment: query.sentiment,
        hasSearch: !!query.search,
        hasDateRange: !!(query.start_date || query.end_date)
      }
    });

    const result = await this.mentionsService.getTableData(tenantId, query);
    
    this.logger.info('GET /mentions/table - Table data retrieved successfully', {
      tenantId,
      totalRecords: result.total,
      returnedRecords: result.data.length,
      page: result.page,
      limit: result.limit
    });

    return result;
  }
}