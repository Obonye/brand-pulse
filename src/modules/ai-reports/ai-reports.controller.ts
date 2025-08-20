import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
  Res,
  StreamableFile,
  Header
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiProduces
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { CurrentTenant } from '../../auth/decorators/current-tenant.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ReportGeneratorService } from './services/report-generator.service';
import { ScheduledReportsService } from './services/scheduled-reports.service';
import { ReportExportService } from './services/report-export.service';
import { 
  GenerateReportDto,
  ExportReportDto,
  ScheduleReportDto,
  UpdateScheduledReportDto
} from './dto';
import {
  ReportQueryDto,
  GeneratedReportResponseDto,
  ReportListResponseDto,
  ExportReportResponseDto,
  ReportStatsDto,
  ScheduledReportResponseDto,
  ScheduledReportDto
} from './dto';

@ApiTags('AI Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('ai-reports')
export class AiReportsController {
  constructor(
    private readonly reportGenerator: ReportGeneratorService,
    private readonly scheduledReports: ScheduledReportsService,
    private readonly reportExport: ReportExportService,
  ) {}

  /**
   * Generate a new AI report
   */
  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Generate AI Report',
    description: 'Generate a new AI-powered brand monitoring report with various types and export formats'
  })
  @ApiResponse({
    status: 201,
    description: 'Report generated successfully',
    type: GeneratedReportResponseDto
  })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async generateReport(
    @Body() generateReportDto: GenerateReportDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any
  ): Promise<GeneratedReportResponseDto> {
    const startTime = Date.now();

    try {
      const report = await this.reportGenerator.generateReport(
        tenantId,
        generateReportDto,
        user?.id
      );

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        message: 'Report generated successfully',
        report,
        processingTime
      };

    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Get all reports with pagination and filtering
   */
  @Get()
  @ApiOperation({ 
    summary: 'Get Reports',
    description: 'Retrieve paginated list of generated reports with optional filtering'
  })
  @ApiResponse({
    status: 200,
    description: 'Reports retrieved successfully',
    type: ReportListResponseDto
  })
  async getReports(
    @Query() query: ReportQueryDto,
    @CurrentTenant() tenantId: string
  ): Promise<ReportListResponseDto> {
    const result = await this.reportGenerator.getReports(tenantId, {
      page: query.page,
      limit: query.limit,
      reportType: query.reportType,
      startDate: query.startDate,
      endDate: query.endDate,
      search: query.search,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder
    });

    return {
      reports: result.reports,
      pagination: result.pagination
    };
  }

  /**
   * Get a specific report by ID
   */
  @Get(':id')
  @ApiOperation({ 
    summary: 'Get Report by ID',
    description: 'Retrieve a specific report by its ID'
  })
  @ApiParam({ name: 'id', description: 'Report ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Report retrieved successfully',
    type: GeneratedReportResponseDto
  })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async getReport(
    @Param('id', ParseUUIDPipe) reportId: string,
    @CurrentTenant() tenantId: string
  ) {
    const report = await this.reportGenerator.getReport(tenantId, reportId);
    
    return {
      success: true,
      message: 'Report retrieved successfully',
      report,
      processingTime: 0
    };
  }

  /**
   * Delete a report
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ 
    summary: 'Delete Report',
    description: 'Delete a specific report by its ID'
  })
  @ApiParam({ name: 'id', description: 'Report ID', type: 'string' })
  @ApiResponse({ status: 204, description: 'Report deleted successfully' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async deleteReport(
    @Param('id', ParseUUIDPipe) reportId: string,
    @CurrentTenant() tenantId: string
  ): Promise<void> {
    await this.reportGenerator.deleteReport(tenantId, reportId);
  }

  /**
   * Export report in various formats
   */
  @Post(':id/export')
  @ApiOperation({ 
    summary: 'Export Report',
    description: 'Export an existing report in various formats (PDF, Excel, CSV, HTML)'
  })
  @ApiParam({ name: 'id', description: 'Report ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Report exported successfully',
    type: ExportReportResponseDto
  })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async exportReport(
    @Param('id', ParseUUIDPipe) reportId: string,
    @Body() exportDto: ExportReportDto,
    @CurrentTenant() tenantId: string
  ): Promise<ExportReportResponseDto> {
    const report = await this.reportGenerator.getReport(tenantId, reportId);
    
    let exportResult: { buffer: Buffer; filename: string; mimeType: string };

    switch (exportDto.format) {
      case 'pdf':
        exportResult = await this.reportExport.exportReportToPDF(report);
        break;
      case 'excel':
        exportResult = await this.reportExport.exportReportToExcel(report);
        break;
      case 'csv':
        const csvContent = await this.reportExport.exportToCSV(report.insights);
        exportResult = {
          buffer: Buffer.from(csvContent, 'utf8'),
          filename: `${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`,
          mimeType: 'text/csv'
        };
        break;
      case 'html':
        exportResult = {
          buffer: Buffer.from(report.content, 'utf8'),
          filename: `${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.html`,
          mimeType: 'text/html'
        };
        break;
      default:
        throw new BadRequestException(`Unsupported export format: ${exportDto.format}`);
    }

    return {
      success: true,
      filename: exportResult.filename,
      mimeType: exportResult.mimeType,
      size: exportResult.buffer.length
    };
  }

  /**
   * Download report file
   */
  @Get(':id/download/:format')
  @ApiOperation({ 
    summary: 'Download Report File',
    description: 'Download report file in specified format'
  })
  @ApiParam({ name: 'id', description: 'Report ID', type: 'string' })
  @ApiParam({ name: 'format', description: 'Export format', enum: ['pdf', 'excel', 'csv', 'html'] })
  @ApiProduces('application/octet-stream')
  @Header('Content-Type', 'application/octet-stream')
  async downloadReport(
    @Param('id', ParseUUIDPipe) reportId: string,
    @Param('format') format: string,
    @CurrentTenant() tenantId: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    const report = await this.reportGenerator.getReport(tenantId, reportId);
    
    let exportResult: { buffer: Buffer; filename: string; mimeType: string };

    switch (format) {
      case 'pdf':
        exportResult = await this.reportExport.exportReportToPDF(report);
        break;
      case 'excel':
        exportResult = await this.reportExport.exportReportToExcel(report);
        break;
      case 'csv':
        const csvContent = await this.reportExport.exportToCSV(report.insights);
        exportResult = {
          buffer: Buffer.from(csvContent, 'utf8'),
          filename: `${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`,
          mimeType: 'text/csv'
        };
        break;
      case 'html':
        exportResult = {
          buffer: Buffer.from(report.content, 'utf8'),
          filename: `${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.html`,
          mimeType: 'text/html'
        };
        break;
      default:
        throw new BadRequestException(`Unsupported format: ${format}`);
    }

    res.set({
      'Content-Type': exportResult.mimeType,
      'Content-Disposition': `attachment; filename="${exportResult.filename}"`
    });

    return new StreamableFile(exportResult.buffer);
  }

  /**
   * Get report generation statistics
   */
  @Get('stats/overview')
  @ApiOperation({ 
    summary: 'Get Report Statistics',
    description: 'Get overview statistics about report generation for the tenant'
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    type: ReportStatsDto
  })
  async getReportStats(
    @CurrentTenant() tenantId: string
  ): Promise<ReportStatsDto> {
    return await this.reportGenerator.getReportStats(tenantId);
  }

  // Scheduled Reports Endpoints

  /**
   * Schedule a new report
   */
  @Post('schedule')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Schedule Report',
    description: 'Schedule a report to be generated automatically using cron expression'
  })
  @ApiResponse({
    status: 201,
    description: 'Report scheduled successfully',
    type: ScheduledReportResponseDto
  })
  @ApiResponse({ status: 400, description: 'Invalid schedule configuration' })
  async scheduleReport(
    @Body() scheduleDto: ScheduleReportDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any
  ): Promise<ScheduledReportResponseDto> {
    const scheduledReport = await this.scheduledReports.createScheduledReport(
      tenantId,
      scheduleDto,
      user?.id
    );

    return {
      success: true,
      message: 'Report scheduled successfully',
      scheduledReport
    };
  }

  /**
   * Get all scheduled reports
   */
  @Get('schedule/list')
  @ApiOperation({ 
    summary: 'Get Scheduled Reports',
    description: 'Get all scheduled reports for the tenant'
  })
  @ApiResponse({
    status: 200,
    description: 'Scheduled reports retrieved successfully',
    type: [ScheduledReportDto]
  })
  async getScheduledReports(
    @CurrentTenant() tenantId: string
  ): Promise<ScheduledReportDto[]> {
    return await this.scheduledReports.getScheduledReports(tenantId);
  }

  /**
   * Get a specific scheduled report
   */
  @Get('schedule/:id')
  @ApiOperation({ 
    summary: 'Get Scheduled Report',
    description: 'Get a specific scheduled report by ID'
  })
  @ApiParam({ name: 'id', description: 'Scheduled Report ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Scheduled report retrieved successfully',
    type: ScheduledReportDto
  })
  @ApiResponse({ status: 404, description: 'Scheduled report not found' })
  async getScheduledReport(
    @Param('id', ParseUUIDPipe) scheduleId: string,
    @CurrentTenant() tenantId: string
  ): Promise<ScheduledReportDto> {
    return await this.scheduledReports.getScheduledReport(tenantId, scheduleId);
  }

  /**
   * Update a scheduled report
   */
  @Post('schedule/:id')
  @ApiOperation({ 
    summary: 'Update Scheduled Report',
    description: 'Update an existing scheduled report configuration'
  })
  @ApiParam({ name: 'id', description: 'Scheduled Report ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Scheduled report updated successfully',
    type: ScheduledReportResponseDto
  })
  @ApiResponse({ status: 404, description: 'Scheduled report not found' })
  async updateScheduledReport(
    @Param('id', ParseUUIDPipe) scheduleId: string,
    @Body() updateDto: UpdateScheduledReportDto,
    @CurrentTenant() tenantId: string
  ): Promise<ScheduledReportResponseDto> {
    const scheduledReport = await this.scheduledReports.updateScheduledReport(
      tenantId,
      scheduleId,
      updateDto
    );

    return {
      success: true,
      message: 'Scheduled report updated successfully',
      scheduledReport
    };
  }

  /**
   * Delete a scheduled report
   */
  @Delete('schedule/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ 
    summary: 'Delete Scheduled Report',
    description: 'Delete a scheduled report by ID'
  })
  @ApiParam({ name: 'id', description: 'Scheduled Report ID', type: 'string' })
  @ApiResponse({ status: 204, description: 'Scheduled report deleted successfully' })
  @ApiResponse({ status: 404, description: 'Scheduled report not found' })
  async deleteScheduledReport(
    @Param('id', ParseUUIDPipe) scheduleId: string,
    @CurrentTenant() tenantId: string
  ): Promise<void> {
    await this.scheduledReports.deleteScheduledReport(tenantId, scheduleId);
  }

  /**
   * Manually trigger a scheduled report
   */
  @Post('schedule/:id/trigger')
  @ApiOperation({ 
    summary: 'Trigger Scheduled Report',
    description: 'Manually trigger execution of a scheduled report'
  })
  @ApiParam({ name: 'id', description: 'Scheduled Report ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Scheduled report triggered successfully',
    type: GeneratedReportResponseDto
  })
  @ApiResponse({ status: 404, description: 'Scheduled report not found' })
  async triggerScheduledReport(
    @Param('id', ParseUUIDPipe) scheduleId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any
  ): Promise<GeneratedReportResponseDto> {
    const startTime = Date.now();

    const report = await this.scheduledReports.executeScheduledReport(
      tenantId,
      scheduleId,
      user?.id
    );

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      message: 'Scheduled report executed successfully',
      report,
      processingTime
    };
  }

  /**
   * Pause/resume a scheduled report
   */
  @Post('schedule/:id/toggle')
  @ApiOperation({ 
    summary: 'Toggle Scheduled Report',
    description: 'Pause or resume a scheduled report'
  })
  @ApiParam({ name: 'id', description: 'Scheduled Report ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Scheduled report status updated successfully',
    type: ScheduledReportResponseDto
  })
  @ApiResponse({ status: 404, description: 'Scheduled report not found' })
  async toggleScheduledReport(
    @Param('id', ParseUUIDPipe) scheduleId: string,
    @CurrentTenant() tenantId: string
  ): Promise<ScheduledReportResponseDto> {
    const scheduledReport = await this.scheduledReports.toggleScheduledReport(
      tenantId,
      scheduleId
    );

    return {
      success: true,
      message: `Scheduled report ${scheduledReport.is_active ? 'activated' : 'deactivated'} successfully`,
      scheduledReport
    };
  }
}