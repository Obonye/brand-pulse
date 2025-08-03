import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../shared/supabase/supabase.service';
import { LoggerService } from '../../common/logger/logger.service';

export interface SentimentTrend {
  period: string;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  total_count: number;
  avg_confidence: number;
  sentiment_score: number;
}

export interface MentionVolumeAnalytics {
  period: string;
  mention_count: number;
  unique_authors: number;
  avg_author_followers: number;
  peak_hour: number;
  trending_score: number;
}

export interface SourcePerformance {
  source_type: string;
  total_mentions: number;
  positive_mentions: number;
  negative_mentions: number;
  neutral_mentions: number;
  avg_sentiment_confidence: number;
  sentiment_score: number;
  top_author: string;
  top_author_mentions: number;
  avg_response_time_hours: number;
}

export interface BrandComparison {
  brand_id: string;
  brand_name: string;
  total_mentions: number;
  positive_percentage: number;
  negative_percentage: number;
  neutral_percentage: number;
  sentiment_score: number;
  avg_confidence: number;
  mention_growth: number;
  top_source: string;
}

export interface AnalyticsSummary {
  total_mentions: number;
  total_positive: number;
  total_negative: number;
  total_neutral: number;
  overall_sentiment_score: number;
  avg_confidence: number;
  unique_authors: number;
  active_sources: number;
  mention_growth: number;
  best_performing_source: string | null;
  worst_performing_source: string | null;
}

@Injectable()
export class AnalyticsService {
  private logger: ReturnType<LoggerService['setContext']>;

  constructor(
    private supabaseService: SupabaseService,
    private loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.setContext('AnalyticsService');
  }

  async getSentimentTrends(
    tenantId: string,
    options: {
      brandId?: string;
      sourceType?: string;
      dateFrom?: string;
      dateTo?: string;
      interval?: 'day' | 'week' | 'month';
    } = {}
  ): Promise<SentimentTrend[]> {
    const dateFrom = options.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const dateTo = options.dateTo || new Date().toISOString();

    this.logger.info('Fetching sentiment trends analytics', {
      tenantId,
      brandId: options.brandId,
      sourceType: options.sourceType,
      dateRange: { from: dateFrom, to: dateTo },
      interval: options.interval || 'day',
      hasFilters: !!(options.brandId || options.sourceType)
    });

    try {
      const { data, error } = await this.supabaseService.adminClient.rpc(
        'get_sentiment_trends',
        {
          p_tenant_id: tenantId,
          p_brand_id: options.brandId || null,
          p_source_type: options.sourceType || null,
          p_date_from: dateFrom,
          p_date_to: dateTo,
          p_interval: options.interval || 'day',
        }
      );

      if (error) {
        this.logger.error('Failed to fetch sentiment trends from database', {
          error: error.message,
          tenantId,
          brandId: options.brandId,
          sourceType: options.sourceType,
          interval: options.interval
        });
        throw new Error(`Failed to get sentiment trends: ${error.message}`);
      }

      this.logger.info('Sentiment trends analytics retrieved successfully', {
        tenantId,
        brandId: options.brandId,
        dataPoints: data?.length || 0,
        interval: options.interval || 'day',
        dateRange: { from: dateFrom, to: dateTo }
      });

      return data || [];
    } catch (error) {
      this.logger.error('Error in getSentimentTrends method', {
        error: error.message,
        tenantId,
        options
      });
      throw error;
    }
  }

  async getMentionVolumeAnalytics(
    tenantId: string,
    options: {
      brandId?: string;
      sourceType?: string;
      dateFrom?: string;
      dateTo?: string;
      interval?: 'day' | 'week' | 'month';
    } = {}
  ): Promise<MentionVolumeAnalytics[]> {
    const dateFrom = options.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const dateTo = options.dateTo || new Date().toISOString();

    this.logger.info('Fetching mention volume analytics', {
      tenantId,
      brandId: options.brandId,
      sourceType: options.sourceType,
      dateRange: { from: dateFrom, to: dateTo },
      interval: options.interval || 'day',
      hasFilters: !!(options.brandId || options.sourceType)
    });

    try {
      const { data, error } = await this.supabaseService.adminClient.rpc(
        'get_mention_volume_analytics',
        {
          p_tenant_id: tenantId,
          p_brand_id: options.brandId || null,
          p_source_type: options.sourceType || null,
          p_date_from: dateFrom,
          p_date_to: dateTo,
          p_interval: options.interval || 'day',
        }
      );

      if (error) {
        this.logger.error('Failed to fetch mention volume analytics from database', {
          error: error.message,
          tenantId,
          brandId: options.brandId,
          sourceType: options.sourceType,
          interval: options.interval
        });
        throw new Error(`Failed to get mention volume analytics: ${error.message}`);
      }

      this.logger.info('Mention volume analytics retrieved successfully', {
        tenantId,
        brandId: options.brandId,
        dataPoints: data?.length || 0,
        interval: options.interval || 'day',
        dateRange: { from: dateFrom, to: dateTo }
      });

      return data || [];
    } catch (error) {
      this.logger.error('Error in getMentionVolumeAnalytics method', {
        error: error.message,
        tenantId,
        options
      });
      throw error;
    }
  }

  async getSourcePerformance(
    tenantId: string,
    options: {
      brandId?: string;
      dateFrom?: string;
      dateTo?: string;
    } = {}
  ): Promise<SourcePerformance[]> {
    try {
      // Default to 30 days if no dates provided
      const dateFrom = options.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const dateTo = options.dateTo || new Date().toISOString();

      const { data, error } = await this.supabaseService.adminClient.rpc(
        'get_source_performance',
        {
          p_tenant_id: tenantId,
          p_brand_id: options.brandId || null,
          p_date_from: dateFrom,
          p_date_to: dateTo,
        }
      );

      if (error) {
        throw new Error(`Failed to get source performance: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      this.logger.error(`Error getting source performance: ${error.message}`);
      throw error;
    }
  }

  async getBrandComparison(
    tenantId: string,
    options: {
      brandIds?: string[];
      dateFrom?: string;
      dateTo?: string;
    } = {}
  ): Promise<BrandComparison[]> {
    try {
      // Default to 30 days if no dates provided
      const dateFrom = options.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const dateTo = options.dateTo || new Date().toISOString();

      const { data, error } = await this.supabaseService.adminClient.rpc(
        'get_brand_comparison',
        {
          p_tenant_id: tenantId,
          p_brand_ids: options.brandIds || null,
          p_date_from: dateFrom,
          p_date_to: dateTo,
        }
      );

      if (error) {
        throw new Error(`Failed to get brand comparison: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      this.logger.error(`Error getting brand comparison: ${error.message}`);
      throw error;
    }
  }

  async getAnalyticsSummary(
    tenantId: string,
    options: {
      brandId?: string;
      dateFrom?: string;
      dateTo?: string;
    } = {}
  ): Promise<AnalyticsSummary> {
    try {
      // Default to 30 days if no dates provided
      const dateFrom = options.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const dateTo = options.dateTo || new Date().toISOString();

      const { data, error } = await this.supabaseService.adminClient.rpc(
        'get_analytics_summary',
        {
          p_tenant_id: tenantId,
          p_brand_id: options.brandId || null,
          p_date_from: dateFrom,
          p_date_to: dateTo,
        }
      );

      if (error) {
        throw new Error(`Failed to get analytics summary: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return {
          total_mentions: 0,
          total_positive: 0,
          total_negative: 0,
          total_neutral: 0,
          overall_sentiment_score: 0,
          avg_confidence: 0,
          unique_authors: 0,
          active_sources: 0,
          mention_growth: 0,
          best_performing_source: null,
          worst_performing_source: null,
        };
      }

      const result = data[0];
      return {
        total_mentions: Number(result.total_mentions) || 0,
        total_positive: Number(result.total_positive) || 0,
        total_negative: Number(result.total_negative) || 0,
        total_neutral: Number(result.total_neutral) || 0,
        overall_sentiment_score: Number(result.overall_sentiment_score) || 0,
        avg_confidence: Number(result.avg_confidence) || 0,
        unique_authors: Number(result.unique_authors) || 0,
        active_sources: Number(result.active_sources) || 0,
        mention_growth: Number(result.mention_growth) || 0,
        best_performing_source: result.best_performing_source || null,
        worst_performing_source: result.worst_performing_source || null,
      };
    } catch (error) {
      this.logger.error(`Error getting analytics summary: ${error.message}`);
      throw error;
    }
  }

  async getDashboardData(tenantId: string, brandId?: string) {
    this.logger.info('Fetching comprehensive dashboard analytics data', {
      tenantId,
      brandId,
      period: 'last_7_days',
      hasBrandFilter: !!brandId
    });

    try {
      // Get data for the last 7 days for dashboard
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 7);
      const dateTo = new Date();

      this.logger.debug('Starting parallel analytics data fetch', {
        tenantId,
        brandId,
        dateRange: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
        queries: ['summary', 'sentiment_trends', 'volume_analytics', 'source_performance']
      });

      const [summary, sentimentTrends, volumeAnalytics, sourcePerformance] = await Promise.all([
        this.getAnalyticsSummary(tenantId, { 
          brandId, 
          dateFrom: dateFrom.toISOString(), 
          dateTo: dateTo.toISOString() 
        }),
        this.getSentimentTrends(tenantId, { 
          brandId, 
          dateFrom: dateFrom.toISOString(), 
          dateTo: dateTo.toISOString(),
          interval: 'day' 
        }),
        this.getMentionVolumeAnalytics(tenantId, { 
          brandId, 
          dateFrom: dateFrom.toISOString(), 
          dateTo: dateTo.toISOString(),
          interval: 'day' 
        }),
        this.getSourcePerformance(tenantId, { 
          brandId, 
          dateFrom: dateFrom.toISOString(), 
          dateTo: dateTo.toISOString() 
        }),
      ]);

      this.logger.info('Dashboard analytics data compiled successfully', {
        tenantId,
        brandId,
        dataPoints: {
          totalMentions: summary.total_mentions,
          sentimentTrendPoints: sentimentTrends.length,
          volumeDataPoints: volumeAnalytics.length,
          sourcesAnalyzed: sourcePerformance.length
        },
        sentimentScore: summary.overall_sentiment_score,
        period: { days: 7, from: dateFrom.toISOString(), to: dateTo.toISOString() }
      });

      return {
        summary,
        sentiment_trends: sentimentTrends,
        volume_analytics: volumeAnalytics,
        source_performance: sourcePerformance,
        period: {
          from: dateFrom.toISOString(),
          to: dateTo.toISOString(),
          days: 7
        }
      };
    } catch (error) {
      this.logger.error('Error compiling dashboard analytics data', {
        error: error.message,
        tenantId,
        brandId,
        stack: error.stack
      });
      throw error;
    }
  }

  async exportAnalytics(
    tenantId: string,
    options: {
      brandId?: string;
      dateFrom?: string;
      dateTo?: string;
      format: 'csv' | 'json';
    }
  ): Promise<string | object> {
    this.logger.info('Starting analytics data export', {
      tenantId,
      brandId: options.brandId,
      format: options.format,
      dateRange: {
        from: options.dateFrom || 'default_30_days',
        to: options.dateTo || 'today'
      }
    });

    try {
      this.logger.debug('Fetching comprehensive analytics data for export', {
        tenantId,
        brandId: options.brandId,
        format: options.format
      });

      // Get comprehensive analytics data
      const [summary, sentimentTrends, volumeAnalytics, sourcePerformance] = await Promise.all([
        this.getAnalyticsSummary(tenantId, {
          brandId: options.brandId,
          dateFrom: options.dateFrom,
          dateTo: options.dateTo,
        }),
        this.getSentimentTrends(tenantId, {
          brandId: options.brandId,
          dateFrom: options.dateFrom,
          dateTo: options.dateTo,
          interval: 'day'
        }),
        this.getMentionVolumeAnalytics(tenantId, {
          brandId: options.brandId,
          dateFrom: options.dateFrom,
          dateTo: options.dateTo,
          interval: 'day'
        }),
        this.getSourcePerformance(tenantId, {
          brandId: options.brandId,
          dateFrom: options.dateFrom,
          dateTo: options.dateTo,
        }),
      ]);

      const exportData = {
        summary,
        sentiment_trends: sentimentTrends,
        volume_analytics: volumeAnalytics,
        source_performance: sourcePerformance,
        export_metadata: {
          tenant_id: tenantId,
          brand_id: options.brandId || 'all',
          date_range: {
            from: options.dateFrom || 'last_30_days',
            to: options.dateTo || 'today'
          },
          exported_at: new Date().toISOString(),
        }
      };

      if (options.format === 'csv') {
        this.logger.info('Converting analytics data to CSV format', {
          tenantId,
          dataPoints: {
            sentimentTrends: sentimentTrends.length,
            volumeAnalytics: volumeAnalytics.length,
            sourcePerformance: sourcePerformance.length
          }
        });
        const csvData = this.convertToCSV(exportData);
        
        this.logger.info('Analytics CSV export completed successfully', {
          tenantId,
          brandId: options.brandId,
          csvLength: csvData.length,
          totalMentions: summary.total_mentions
        });
        
        return csvData;
      }

      this.logger.info('Analytics JSON export completed successfully', {
        tenantId,
        brandId: options.brandId,
        format: 'json',
        dataPoints: {
          sentimentTrends: sentimentTrends.length,
          volumeAnalytics: volumeAnalytics.length,
          sourcePerformance: sourcePerformance.length
        },
        totalMentions: summary.total_mentions
      });

      return exportData;
    } catch (error) {
      this.logger.error('Error during analytics export process', {
        error: error.message,
        tenantId,
        brandId: options.brandId,
        format: options.format,
        stack: error.stack
      });
      throw error;
    }
  }

  private convertToCSV(data: any): string {
    const lines: string[] = [];
    
    // Add summary section
    lines.push('ANALYTICS SUMMARY');
    lines.push('Metric,Value');
    lines.push(`Total Mentions,${data.summary.total_mentions}`);
    lines.push(`Positive Mentions,${data.summary.total_positive}`);
    lines.push(`Negative Mentions,${data.summary.total_negative}`);
    lines.push(`Neutral Mentions,${data.summary.total_neutral}`);
    lines.push(`Overall Sentiment Score,${data.summary.overall_sentiment_score}`);
    lines.push(`Average Confidence,${data.summary.avg_confidence}`);
    lines.push(`Unique Authors,${data.summary.unique_authors}`);
    lines.push(`Mention Growth %,${data.summary.mention_growth}`);
    lines.push('');

    // Add sentiment trends
    if (data.sentiment_trends?.length > 0) {
      lines.push('SENTIMENT TRENDS');
      lines.push('Period,Positive Count,Negative Count,Neutral Count,Total Count,Sentiment Score');
      data.sentiment_trends.forEach((trend: any) => {
        lines.push(`${trend.period},${trend.positive_count},${trend.negative_count},${trend.neutral_count},${trend.total_count},${trend.sentiment_score}`);
      });
      lines.push('');
    }

    // Add volume analytics
    if (data.volume_analytics?.length > 0) {
      lines.push('VOLUME ANALYTICS');
      lines.push('Period,Mention Count,Unique Authors,Trending Score');
      data.volume_analytics.forEach((volume: any) => {
        lines.push(`${volume.period},${volume.mention_count},${volume.unique_authors},${volume.trending_score}`);
      });
      lines.push('');
    }

    // Add source performance
    if (data.source_performance?.length > 0) {
      lines.push('SOURCE PERFORMANCE');
      lines.push('Source Type,Total Mentions,Positive,Negative,Neutral,Sentiment Score,Avg Confidence');
      data.source_performance.forEach((source: any) => {
        lines.push(`${source.source_type},${source.total_mentions},${source.positive_mentions},${source.negative_mentions},${source.neutral_mentions},${source.sentiment_score},${source.avg_sentiment_confidence}`);
      });
    }

    return lines.join('\n');
  }
}