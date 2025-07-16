import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { MentionsService } from './mentions.service';
import { GetMentionsTableQueryDto, MentionsTableResponseDto } from './dto/mentions-table.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('mentions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
export class MentionsController {
  constructor(private readonly mentionsService: MentionsService) {}

  @Get('table')
  async getTableData(
    @CurrentTenant() tenantId: string,
    @Query() query: GetMentionsTableQueryDto,
  ): Promise<MentionsTableResponseDto> {
    return this.mentionsService.getTableData(tenantId, query);
  }
}