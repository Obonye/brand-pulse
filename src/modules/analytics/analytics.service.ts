import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../shared/supabase/supabase.service';

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
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private supabaseService: SupabaseService) {}

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
    try {
      // Default to 30 days if no dates provided
      const dateFrom = options.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const dateTo = options.dateTo || new Date().toISOString();

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
        throw new Error(`Failed to get sentiment trends: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      this.logger.error(`Error getting sentiment trends: ${error.message}`);
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
    try {
      // Default to 30 days if no dates provided
      const dateFrom = options.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const dateTo = options.dateTo || new Date().toISOString();

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
        throw new Error(`Failed to get mention volume analytics: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      this.logger.error(`Error getting mention volume analytics: ${error.message}`);
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
    try {
      // Get data for the last 7 days for dashboard
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 7);
      const dateTo = new Date();

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
      this.logger.error(`Error getting dashboard data: ${error.message}`);
      throw error;
    }
  }
}