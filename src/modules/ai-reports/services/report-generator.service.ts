import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../shared/supabase/supabase.service';
import { ReportDataService } from './report-data.service';
import { OpenAIReportService } from './openai-report.service';
import { TemplateEngineService } from './template-engine.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { ReportExportService } from './report-export.service';
import { 
  ReportOptions, 
  ReportInsights, 
  GeneratedReport,
  MentionReportData,
  MentionSummaryStats
} from '../interfaces/report-data.interface';
import { GenerateReportDto } from '../dto/generate-report.dto';

@Injectable()
export class ReportGeneratorService {
  private readonly logger = new Logger(ReportGeneratorService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly reportDataService: ReportDataService,
    private readonly openaiReportService: OpenAIReportService,
    private readonly templateEngine: TemplateEngineService,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly reportExport: ReportExportService,
  ) {}

  /**
   * Generate a complete AI report with all processing steps
   */
  async generateReport(
    tenantId: string,
    generateReportDto: GenerateReportDto,
    userId?: string
  ): Promise<GeneratedReport> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Starting report generation`, {
        tenantId,
        reportType: generateReportDto.reportType,
        userId
      });

      // Step 1: Validate input and prepare options
      const reportOptions = this.prepareReportOptions(generateReportDto);
      
      // Step 2: Validate tenant has sufficient data
      const validation = await this.reportDataService.validateTenantData(tenantId, reportOptions);
      if (!validation.isValid) {
        throw new BadRequestException(`Insufficient data for report generation: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        this.logger.warn(`Data quality warnings`, {
          tenantId,
          warnings: validation.warnings
        });
      }

      // Step 3: Fetch complete dataset
      const { mentions, stats } = await this.reportDataService.getCompleteReportData(tenantId, reportOptions);

      // Step 4: Process data into insights
      const insights = this.processDataIntoInsights(mentions, stats, reportOptions);

      // Step 5: Generate AI content
      const aiResult = await this.openaiReportService.generateReport(
        insights,
        generateReportDto.reportType,
        generateReportDto.customInstructions
      );

      // Step 6: Render HTML template
      const htmlContent = await this.templateEngine.renderReport(
        generateReportDto.reportType,
        {
          ...insights,
          aiContent: aiResult.content,
          aiSummary: aiResult.summary,
          metadata: {
            generatedAt: new Date().toISOString(),
            reportType: generateReportDto.reportType,
            dateRange: `${reportOptions.startDate || 'All time'} to ${reportOptions.endDate || 'Now'}`,
            aiModel: aiResult.model,
            processingTime: aiResult.processingTime,
            confidenceThresholds: insights.confidenceThresholds
          }
        }
      );

      // Step 7: Generate PDF if requested
      let pdfBuffer: Buffer | null = null;
      if (generateReportDto.formats?.includes('pdf')) {
        pdfBuffer = await this.pdfGenerator.generatePDF(htmlContent, {
          reportType: generateReportDto.reportType,
          title: this.generateReportTitle(generateReportDto.reportType, insights)
        });
      }

      // Step 8: Save report to database
      const savedReport = await this.saveReport(
        tenantId,
        generateReportDto,
        insights,
        aiResult,
        htmlContent,
        reportOptions,
        userId
      );

      // Step 9: Handle file exports if requested
      const exports = await this.handleExports(
        savedReport.id,
        generateReportDto.formats || ['html'],
        htmlContent,
        pdfBuffer,
        insights
      );

      const totalProcessingTime = Date.now() - startTime;
      
      this.logger.log(`Successfully generated report`, {
        tenantId,
        reportId: savedReport.id,
        reportType: generateReportDto.reportType,
        totalProcessingTime,
        aiProcessingTime: aiResult.processingTime,
        tokensUsed: aiResult.tokensUsed,
        mentionsProcessed: mentions.length
      });

      return {
        ...savedReport,
        exports,
        processingStats: {
          totalTime: totalProcessingTime,
          aiTime: aiResult.processingTime,
          tokensUsed: aiResult.tokensUsed,
          mentionsProcessed: mentions.length,
          model: aiResult.model
        }
      };

    } catch (error) {
      this.logger.error(`Failed to generate report`, {
        error: error.message,
        tenantId,
        reportType: generateReportDto.reportType,
        processingTime: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Get existing report by ID
   */
  async getReport(tenantId: string, reportId: string): Promise<GeneratedReport> {
    try {
      const { data, error } = await this.supabaseService.adminClient
        .from('ai_reports')
        .select('*')
        .eq('id', reportId)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !data) {
        throw new NotFoundException(`Report not found`);
      }

      return {
        id: data.id,
        tenant_id: data.tenant_id,
        report_type: data.report_type,
        title: data.title,
        content: data.content,
        summary: data.summary,
        insights: data.insights,
        metadata: data.metadata,
        date_from: data.date_from,
        date_to: data.date_to,
        generated_at: data.generated_at,
        created_at: data.created_at,
        updated_at: data.updated_at
      };

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Failed to fetch report', {
        error: error.message,
        tenantId,
        reportId
      });
      throw new Error(`Failed to fetch report: ${error.message}`);
    }
  }

  /**
   * Get reports list with pagination and filters
   */
  async getReports(
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      reportType?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{
    reports: GeneratedReport[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    try {
      const page = options.page || 1;
      const limit = Math.min(options.limit || 10, 100);
      const offset = (page - 1) * limit;
      const sortBy = options.sortBy || 'generated_at';
      const sortOrder = options.sortOrder || 'desc';

      // Build query
      let query = this.supabaseService.adminClient
        .from('ai_reports')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId);

      // Apply filters
      if (options.reportType) {
        query = query.eq('report_type', options.reportType);
      }

      if (options.startDate) {
        query = query.gte('generated_at', options.startDate);
      }

      if (options.endDate) {
        query = query.lte('generated_at', options.endDate);
      }

      if (options.search) {
        query = query.or(`title.ilike.%${options.search}%,content.ilike.%${options.search}%`);
      }

      // Apply sorting and pagination
      query = query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Failed to fetch reports: ${error.message}`);
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        reports: data || [],
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };

    } catch (error) {
      this.logger.error('Failed to fetch reports list', {
        error: error.message,
        tenantId,
        options
      });
      throw error;
    }
  }

  /**
   * Delete a report
   */
  async deleteReport(tenantId: string, reportId: string): Promise<boolean> {
    try {
      const { error } = await this.supabaseService.adminClient
        .from('ai_reports')
        .delete()
        .eq('id', reportId)
        .eq('tenant_id', tenantId);

      if (error) {
        throw new Error(`Failed to delete report: ${error.message}`);
      }

      this.logger.log(`Successfully deleted report`, {
        tenantId,
        reportId
      });

      return true;

    } catch (error) {
      this.logger.error('Failed to delete report', {
        error: error.message,
        tenantId,
        reportId
      });
      throw error;
    }
  }

  /**
   * Get report generation statistics
   */
  async getReportStats(tenantId: string): Promise<{
    totalReports: number;
    reportsByType: Record<string, number>;
    reportsThisMonth: number;
    avgProcessingTime: number;
    lastGenerated: string | null;
    mostPopularType: string | null;
  }> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await this.supabaseService.adminClient
        .from('ai_reports')
        .select('report_type, generated_at, metadata')
        .eq('tenant_id', tenantId);

      if (error) {
        throw new Error(`Failed to fetch report stats: ${error.message}`);
      }

      const reports = data || [];
      const reportsByType: Record<string, number> = {};
      let totalProcessingTime = 0;
      let processedReports = 0;
      let lastGenerated: string | null = null;
      let reportsThisMonth = 0;

      for (const report of reports) {
        // Count by type
        reportsByType[report.report_type] = (reportsByType[report.report_type] || 0) + 1;

        // Count this month
        if (new Date(report.generated_at) >= thirtyDaysAgo) {
          reportsThisMonth++;
        }

        // Track processing time
        if (report.metadata?.processingTime) {
          totalProcessingTime += report.metadata.processingTime;
          processedReports++;
        }

        // Track last generated
        if (!lastGenerated || report.generated_at > lastGenerated) {
          lastGenerated = report.generated_at;
        }
      }

      // Find most popular type
      let mostPopularType: string | null = null;
      let maxCount = 0;
      for (const [type, count] of Object.entries(reportsByType)) {
        if (count > maxCount) {
          maxCount = count;
          mostPopularType = type;
        }
      }

      return {
        totalReports: reports.length,
        reportsByType,
        reportsThisMonth,
        avgProcessingTime: processedReports > 0 ? totalProcessingTime / processedReports : 0,
        lastGenerated,
        mostPopularType
      };

    } catch (error) {
      this.logger.error('Failed to fetch report stats', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Prepare report options from DTO
   */
  private prepareReportOptions(dto: GenerateReportDto): ReportOptions {
    const options: ReportOptions = {};

    if (dto.startDate) options.startDate = dto.startDate;
    if (dto.endDate) options.endDate = dto.endDate;
    if (dto.brandIds && dto.brandIds.length > 0) options.brandIds = dto.brandIds;
    if (dto.sourceTypes && dto.sourceTypes.length > 0) options.sourceTypes = dto.sourceTypes;
    if (dto.limit) options.limit = dto.limit;
    if (dto.minTagConfidence !== undefined) options.minTagConfidence = dto.minTagConfidence;
    if (dto.minTopicConfidence !== undefined) options.minTopicConfidence = dto.minTopicConfidence;

    return options;
  }

  /**
   * Process raw data into structured insights
   */
  private processDataIntoInsights(
    mentions: MentionReportData[],
    stats: MentionSummaryStats,
    options: ReportOptions
  ): ReportInsights {
    // Calculate sentiment breakdown
    const sentimentBreakdown = {
      positive: stats.sentiment_positive,
      negative: stats.sentiment_negative,
      neutral: stats.sentiment_neutral,
      avgConfidence: stats.avg_sentiment_confidence
    };

    // Calculate priority breakdown
    const priorityBreakdown = {
      high: stats.high_priority_count,
      medium: stats.medium_priority_count,
      low: stats.low_priority_count,
      avgUrgency: stats.avg_urgency_score
    };

    // Extract high priority mentions (top 10)
    const highPriorityMentions = mentions
      .filter(m => m.max_urgency_score >= 7)
      .sort((a, b) => b.max_urgency_score - a.max_urgency_score)
      .slice(0, 10);

    // Extract positive highlights (top 5)
    const positiveMentions = mentions
      .filter(m => m.sentiment === 'positive')
      .sort((a, b) => b.sentiment_confidence - a.sentiment_confidence)
      .slice(0, 5);

    // Extract negative concerns (top 5)
    const negativeMentions = mentions
      .filter(m => m.sentiment === 'negative')
      .sort((a, b) => b.sentiment_confidence - a.sentiment_confidence)
      .slice(0, 5);

    return {
      totalMentions: stats.total_mentions,
      dateRange: {
        from: options.startDate || 'All time',
        to: options.endDate || 'Now'
      },
      sentimentBreakdown,
      priorityBreakdown,
      uniqueAuthors: stats.unique_authors,
      topSourceTypes: stats.top_source_types || [],
      topCategories: stats.top_categories || [],
      topTopics: stats.top_topics || [],
      highPriorityMentions,
      positiveMentions,
      negativeMentions,
      confidenceThresholds: {
        tags: options.minTagConfidence || 0.7,
        topics: options.minTopicConfidence || 0.6
      }
    };
  }

  /**
   * Generate appropriate title for report
   */
  private generateReportTitle(reportType: string, insights: ReportInsights): string {
    const typeNames = {
      'executive-summary': 'Executive Summary',
      'sentiment-intelligence': 'Sentiment Intelligence Report',
      'competitive-analysis': 'Competitive Analysis',
      'category-performance': 'Category Performance Analysis',
      'crisis-alert': 'Crisis Alert Report',
      'trend-analysis': 'Trend Analysis Report'
    };

    const baseName = typeNames[reportType] || 'Brand Report';
    const dateStr = new Date().toLocaleDateString();
    
    return `${baseName} - ${dateStr}`;
  }

  /**
   * Save generated report to database
   */
  private async saveReport(
    tenantId: string,
    dto: GenerateReportDto,
    insights: ReportInsights,
    aiResult: any,
    htmlContent: string,
    options: ReportOptions,
    userId?: string
  ): Promise<GeneratedReport> {
    const reportData = {
      tenant_id: tenantId,
      report_type: dto.reportType,
      title: this.generateReportTitle(dto.reportType, insights),
      content: htmlContent,
      summary: aiResult.summary,
      insights: insights,
      metadata: {
        dateRange: `${options.startDate || 'All time'} to ${options.endDate || 'Now'}`,
        generatedAt: new Date().toISOString(),
        confidenceThreshold: options.minTagConfidence || 0.7,
        aiModel: aiResult.model,
        processingTime: aiResult.processingTime,
        tokensUsed: aiResult.tokensUsed,
        userId: userId || null,
        customInstructions: dto.customInstructions || null
      },
      date_from: options.startDate || null,
      date_to: options.endDate || null,
      generated_at: new Date().toISOString()
    };

    const { data, error } = await this.supabaseService.adminClient
      .from('ai_reports')
      .insert([reportData])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save report: ${error.message}`);
    }

    return data;
  }

  /**
   * Handle multiple export formats
   */
  private async handleExports(
    reportId: string,
    formats: string[],
    htmlContent: string,
    pdfBuffer: Buffer | null,
    insights: ReportInsights
  ): Promise<Record<string, any>> {
    const exports: Record<string, any> = {};

    for (const format of formats) {
      try {
        switch (format) {
          case 'pdf':
            if (pdfBuffer) {
              exports.pdf = {
                size: pdfBuffer.length,
                mimeType: 'application/pdf'
              };
            }
            break;
          
          case 'html':
            exports.html = {
              size: Buffer.byteLength(htmlContent, 'utf8'),
              mimeType: 'text/html'
            };
            break;
          
          case 'excel':
            const excelBuffer = await this.reportExport.exportToExcel(insights, reportId);
            exports.excel = {
              size: excelBuffer.length,
              mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            };
            break;
          
          case 'csv':
            const csvContent = await this.reportExport.exportToCSV(insights);
            exports.csv = {
              size: Buffer.byteLength(csvContent, 'utf8'),
              mimeType: 'text/csv'
            };
            break;
        }
      } catch (error) {
        this.logger.warn(`Failed to generate ${format} export`, {
          error: error.message,
          reportId,
          format
        });
      }
    }

    return exports;
  }
}