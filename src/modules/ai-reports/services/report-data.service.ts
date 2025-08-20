import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../shared/supabase/supabase.service';
import { 
  MentionReportData, 
  MentionSummaryStats, 
  ReportOptions 
} from '../interfaces/report-data.interface';

@Injectable()
export class ReportDataService {
  private readonly logger = new Logger(ReportDataService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Get mentions data for report generation using RPC function
   */
  async getMentionsForReport(
    tenantId: string,
    options: ReportOptions
  ): Promise<MentionReportData[]> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Fetching mentions for tenant ${tenantId}`, {
        tenantId,
        options
      });

      const { data, error } = await this.supabaseService.adminClient
        .rpc('get_mentions_report_data', {
          p_tenant_id: tenantId,
          p_start_date: options.startDate || null,
          p_end_date: options.endDate || null,
          p_brand_ids: options.brandIds || null,
          p_source_types: options.sourceTypes || null,
          p_limit_count: options.limit || 1000,
          p_min_tag_confidence: options.minTagConfidence || 0.7,
          p_min_topic_confidence: options.minTopicConfidence || 0.6
        });

      if (error) {
        this.logger.error('Failed to fetch mention report data', {
          error: error.message,
          tenantId,
          options
        });
        throw new Error(`Failed to fetch report data: ${error.message}`);
      }

      const processingTime = Date.now() - startTime;
      this.logger.log(`Successfully fetched ${data?.length || 0} mentions for report`, {
        tenantId,
        mentionCount: data?.length || 0,
        processingTime
      });

      return data || [];

    } catch (error) {
      this.logger.error('Error in getMentionsForReport', {
        error: error.message,
        tenantId,
        options
      });
      throw error;
    }
  }

  /**
   * Get summary statistics for report generation using RPC function
   */
  async getSummaryStats(
    tenantId: string,
    options: ReportOptions
  ): Promise<MentionSummaryStats> {
    const startTime = Date.now();

    try {
      this.logger.debug(`Fetching summary stats for tenant ${tenantId}`, {
        tenantId,
        options
      });

      const { data, error } = await this.supabaseService.adminClient
        .rpc('get_mentions_summary_stats', {
          p_tenant_id: tenantId,
          p_start_date: options.startDate || null,
          p_end_date: options.endDate || null,
          p_brand_ids: options.brandIds || null
        });

      if (error) {
        this.logger.error('Failed to fetch summary stats', {
          error: error.message,
          tenantId,
          options
        });
        throw new Error(`Failed to fetch summary stats: ${error.message}`);
      }

      const processingTime = Date.now() - startTime;
      this.logger.log(`Successfully fetched summary stats for report`, {
        tenantId,
        totalMentions: data?.[0]?.total_mentions || 0,
        processingTime
      });

      // Return the first row as it contains aggregated stats
      return data?.[0] || this.getEmptyStats();

    } catch (error) {
      this.logger.error('Error in getSummaryStats', {
        error: error.message,
        tenantId,
        options
      });
      throw error;
    }
  }

  /**
   * Get mentions data and summary stats concurrently
   */
  async getCompleteReportData(
    tenantId: string,
    options: ReportOptions
  ): Promise<{
    mentions: MentionReportData[];
    stats: MentionSummaryStats;
  }> {
    const startTime = Date.now();

    try {
      this.logger.debug(`Fetching complete report data for tenant ${tenantId}`, {
        tenantId,
        options
      });

      // Fetch both datasets concurrently for better performance
      const [mentions, stats] = await Promise.all([
        this.getMentionsForReport(tenantId, options),
        this.getSummaryStats(tenantId, options)
      ]);

      const processingTime = Date.now() - startTime;
      this.logger.log(`Successfully fetched complete report data`, {
        tenantId,
        mentionCount: mentions.length,
        totalMentions: stats.total_mentions,
        processingTime
      });

      return { mentions, stats };

    } catch (error) {
      this.logger.error('Error in getCompleteReportData', {
        error: error.message,
        tenantId,
        options
      });
      throw error;
    }
  }

  /**
   * Validate tenant has sufficient data for report generation
   */
  async validateTenantData(
    tenantId: string,
    options: ReportOptions
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    stats: {
      totalMentions: number;
      dateRange: string;
      hasAITags: boolean;
      hasTopics: boolean;
    };
  }> {
    try {
      const stats = await this.getSummaryStats(tenantId, options);
      const errors: string[] = [];
      const warnings: string[] = [];

      // Check minimum data requirements
      if (stats.total_mentions === 0) {
        errors.push('No mentions found for the specified criteria');
      } else if (stats.total_mentions < 10) {
        warnings.push(`Only ${stats.total_mentions} mentions found. Reports may have limited insights.`);
      }

      // Check for AI tags
      const hasAITags = (stats.top_categories?.length || 0) > 0;
      if (!hasAITags) {
        warnings.push('No AI tags found. Category and intent analysis may be limited.');
      }

      // Check for topics
      const hasTopics = (stats.top_topics?.length || 0) > 0;
      if (!hasTopics) {
        warnings.push('No topics found. Topic analysis may be limited.');
      }

      // Check sentiment distribution
      if (stats.avg_sentiment_confidence < 0.5) {
        warnings.push('Low average sentiment confidence. Sentiment analysis may be unreliable.');
      }

      const dateFrom = options.startDate || 'beginning';
      const dateTo = options.endDate || 'now';

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        stats: {
          totalMentions: stats.total_mentions,
          dateRange: `${dateFrom} to ${dateTo}`,
          hasAITags,
          hasTopics
        }
      };

    } catch (error) {
      this.logger.error('Error validating tenant data', {
        error: error.message,
        tenantId,
        options
      });

      return {
        isValid: false,
        errors: [`Failed to validate data: ${error.message}`],
        warnings: [],
        stats: {
          totalMentions: 0,
          dateRange: 'unknown',
          hasAITags: false,
          hasTopics: false
        }
      };
    }
  }

  /**
   * Get date range for automatic report scheduling
   */
  getDateRangeForSchedule(reportType: string): { startDate: string; endDate: string } {
    const now = new Date();
    const endDate = now.toISOString();
    let startDate: string;

    switch (reportType) {
      case 'daily-executive':
      case 'crisis-alert':
        // Last 24 hours
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        break;
      
      case 'weekly-comprehensive':
      case 'sentiment-intelligence':
      case 'category-performance':
        // Last 7 days
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      
      case 'monthly-strategic':
      case 'competitive-analysis':
      case 'trend-analysis':
        // Last 30 days
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
      
      default:
        // Default to last 7 days
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    return { startDate, endDate };
  }

  /**
   * Get empty stats object for fallback
   */
  private getEmptyStats(): MentionSummaryStats {
    return {
      total_mentions: 0,
      sentiment_positive: 0,
      sentiment_negative: 0,
      sentiment_neutral: 0,
      avg_sentiment_confidence: 0,
      high_priority_count: 0,
      medium_priority_count: 0,
      low_priority_count: 0,
      avg_urgency_score: 0,
      unique_authors: 0,
      top_source_types: [],
      top_categories: [],
      top_topics: []
    };
  }
}