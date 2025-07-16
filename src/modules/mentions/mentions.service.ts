import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../shared/supabase/supabase.service';
import { ApifyService, ApifyDatasetItem } from '../shared/apify/apify.service';
import { SentimentService } from '../sentiment/sentiment.service';
import { ScrapedMention } from './entities/mention.entity';

@Injectable()
export class MentionsService {
  private readonly logger = new Logger(MentionsService.name);

  constructor(
    private supabaseService: SupabaseService,
    private apifyService: ApifyService,
    private sentimentService: SentimentService,
  ) {}

  /**
   * Process and store mentions from completed Apify run
   */
  async processApifyRunData(scraperRun: any): Promise<void> {
    try {
      this.logger.log(`Processing mentions for scraper run ${scraperRun.id}`);

      // Get Apify run data - use the actual apify_run_id field from database
      const apifyRunId = scraperRun.apify_run_id;
      if (!apifyRunId) {
        throw new Error('No Apify run ID found in scraper run record');
      }

      // Fetch data from Apify
      const apifyData = await this.apifyService.getRunData(apifyRunId);
      this.logger.log(`Retrieved ${apifyData.length} items from Apify run ${apifyRunId}`);

      if (apifyData.length === 0) {
        this.logger.warn(`No data found in Apify run ${apifyRunId}`);
        return;
      }

      // Transform and insert mentions
      const mentions = this.transformApifyDataToMentions(apifyData, scraperRun);
      const insertedMentions = await this.insertMentions(mentions);

      this.logger.log(`Successfully inserted ${insertedMentions.length} mentions for run ${scraperRun.id}`);

      // Trigger sentiment analysis for newly inserted mentions
      if (insertedMentions.length > 0) {
        this.triggerSentimentAnalysis(insertedMentions, scraperRun.scraper_jobs?.brands?.name);
      }

      // Update scraper run with processing stats
      await this.updateScraperRunStats(scraperRun.id, apifyData.length, insertedMentions.length);

    } catch (error) {
      this.logger.error(`Failed to process Apify run data: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Transform Apify data to mentions format
   */
  private transformApifyDataToMentions(apifyData: ApifyDatasetItem[], scraperRun: any): Partial<ScrapedMention>[] {
    const job = scraperRun.scraper_jobs;
    
    return apifyData.map((item, index) => {
      // Generate a source_id if not provided - use Instagram comment ID for comments
      const sourceId = item.id || item.reviewId || item.postId || 
                      this.generateSourceId(item.url || item.postUrl || item.title || '', index);

      return {
        tenant_id: scraperRun.tenant_id,
        brand_id: job.brand_id,
        job_run_id: scraperRun.id,
        source_type: job.source_type,
        source_url: item.postUrl || item.url, // Use postUrl for Instagram comments
        source_id: sourceId,
        title: item.title || item.name,
        content: item.text || item.reviewText || item.content || item.description || '',
        author: item.ownerUsername || item.author || item.reviewer || item.username,
        author_url: item.ownerProfilePicUrl || item.authorUrl || item.profileUrl,
        author_followers: item.followers || item.followerCount,
        published_at: this.parseDate(item.timestamp || item.publishedAt || item.createdAt || item.date) || undefined,
        language: item.language || 'en',
        metadata: this.buildMetadata(item, job.source_type),
      };
    }).filter(mention => mention.content && mention.content.trim().length > 0);
  }

  /**
   * Build metadata object based on source type and platform data
   */
  private buildMetadata(item: any, sourceType: string): Record<string, any> {
    const baseMetadata = {
      rating: item.rating || item.stars,
      likes: item.likes || item.likeCount,
      shares: item.shares || item.shareCount,
      replies: item.replies || item.replyCount,
      platform_data: item,
    };

    // Add source-specific metadata
    switch (sourceType) {
      case 'instagram_posts':
        return {
          ...baseMetadata,
          // Key Instagram posts fields for analytics
          hashtags: item.hashtags || [],
          likes_count: item.likesCount || 0,
          comments_count: item.commentsCount || 0,
          video_play_count: item.videoPlayCount || 0,
          video_view_count: item.videoViewCount || 0,
          location_name: item.locationName,
          location_id: item.locationId,
          product_type: item.productType, // 'clips', 'feed', etc.
          is_sponsored: item.isSponsored || false,
          video_duration: item.videoDuration,
          owner_full_name: item.ownerFullName,
          owner_id: item.ownerId,
          short_code: item.shortCode,
          post_type: item.type, // 'Video', 'Image', etc.

        };

      case 'instagram':
      case 'instagram_comments':
        return {
          ...baseMetadata,
          // Instagram comments specific fields
          comment_replies_count: item.repliesCount || 0,
          comment_likes_count: item.likesCount || 0,
          owner_username: item.ownerUsername,
          owner_profile_pic: item.ownerProfilePicUrl,
          owner_id: item.owner?.id,
          is_verified: item.owner?.is_verified || false,
        };

      case 'google_reviews':
        return {
          ...baseMetadata,
          // Google Reviews specific fields
          review_rating: item.rating || item.stars,
          review_date: item.publishedAt || item.date,
          reviewer_name: item.author || item.reviewer,
          business_name: item.businessName,
          business_address: item.address,
          review_response: item.response,
        };

      default:
        return baseMetadata;
    }
  }

  /**
   * Insert mentions into database with conflict handling
   */
  private async insertMentions(mentions: Partial<ScrapedMention>[]): Promise<ScrapedMention[]> {
    if (mentions.length === 0) return [];

    try {
      // Insert with ON CONFLICT handling for duplicates
      const { data, error } = await this.supabaseService.adminClient
        .from('scraped_mentions')
        .upsert(mentions, { 
          onConflict: 'tenant_id,source_type,source_id',
          ignoreDuplicates: false 
        })
        .select('*');

      if (error) {
        this.logger.error(`Failed to insert mentions: ${error.message}`);
        throw new BadRequestException(`Failed to insert mentions: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      this.logger.error(`Database error inserting mentions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Trigger sentiment analysis for newly inserted mentions
   */
  private async triggerSentimentAnalysis(mentions: ScrapedMention[], brandName?: string): Promise<void> {
    try {
      this.logger.log(`Triggering sentiment analysis for ${mentions.length} mentions`);
      
      // Run sentiment analysis asynchronously to avoid blocking the webhook response
      setImmediate(async () => {
        try {
          await this.sentimentService.batchAnalyzeMentions(mentions, brandName);
        } catch (error) {
          this.logger.error(`Sentiment analysis failed: ${error.message}`);
        }
      });
    } catch (error) {
      this.logger.warn(`Failed to trigger sentiment analysis: ${error.message}`);
    }
  }

  /**
   * Update scraper run with processing statistics
   */
  private async updateScraperRunStats(runId: string, totalItems: number, insertedItems: number): Promise<void> {
    try {
      await this.supabaseService.adminClient
        .from('scraper_runs')
        .update({
          items_found: totalItems,
          items_processed: insertedItems,
          items_failed: totalItems - insertedItems,
          updated_at: new Date().toISOString(),
        })
        .eq('id', runId);
    } catch (error) {
      this.logger.warn(`Failed to update scraper run stats: ${error.message}`);
    }
  }

  /**
   * Generate a source ID from URL or title
   */
  private generateSourceId(source: string, index: number): string {
    if (!source) return `generated_${Date.now()}_${index}`;
    
    // Extract ID from URL patterns
    const urlPatterns = [
      /\/reviews\/([^\/\?]+)/,
      /\/posts\/([^\/\?]+)/,
      /\/([a-zA-Z0-9_-]+)$/,
      /id=([^&]+)/,
    ];

    for (const pattern of urlPatterns) {
      const match = source.match(pattern);
      if (match) return match[1];
    }

    // Fallback: create hash from content
    return `hash_${this.simpleHash(source)}_${index}`;
  }

  /**
   * Simple hash function for generating IDs
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Parse various date formats
   */
  private parseDate(dateString: string | null | undefined): string | null {
    if (!dateString) return null;

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return null;
      return date.toISOString();
    } catch {
      return null;
    }
  }

  /**
   * Get mentions for a tenant
   */
  async findAll(tenantId: string, limit = 100, offset = 0): Promise<ScrapedMention[]> {
    try {
      const { data, error } = await this.supabaseService.adminClient
        .from('scraped_mentions')
        .select(`
          *,
          brands (
            id,
            name
          )
        `)
        .eq('tenant_id', tenantId)
        .order('scraped_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new BadRequestException(`Failed to fetch mentions: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      throw new BadRequestException('Failed to fetch mentions');
    }
  }

  /**
   * Get mentions data for table display with joins
   */
  async getTableData(
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      brand_id?: string;
      source_type?: string;
      sentiment?: 'positive' | 'negative' | 'neutral';
      search?: string;
      start_date?: string;
      end_date?: string;
    } = {}
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    try {
      const {
        page = 1,
        limit = 50,
        brand_id,
        source_type,
        sentiment,
        search,
        start_date,
        end_date,
      } = options;

      const offset = (page - 1) * limit;

      // Build query with joins
      let query = this.supabaseService.adminClient
        .from('scraped_mentions')
        .select(`
          id,
          content,
          source_type,
          source_url,
          author,
          published_at,
          scraped_at,
          brands!inner (
            id,
            name
          ),
          sentiment_analysis!inner (
            sentiment,
            confidence
          )
        `, { count: 'exact' })
        .eq('tenant_id', tenantId);

      // Apply filters
      if (brand_id) {
        query = query.eq('brand_id', brand_id);
      }

      if (source_type) {
        query = query.eq('source_type', source_type);
      }

      if (search) {
        query = query.or(`content.ilike.%${search}%,author.ilike.%${search}%`);
      }

      if (start_date) {
        query = query.gte('published_at', start_date);
      }

      if (end_date) {
        query = query.lte('published_at', end_date);
      }

      // Apply sentiment filter if specified
      if (sentiment) {
        query = query.not('sentiment_analysis', 'is', null)
          .eq('sentiment_analysis.sentiment', sentiment);
      }

      // Add ordering and pagination
      query = query
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('scraped_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        this.logger.error(`Failed to fetch table data: ${error.message}`);
        throw new BadRequestException(`Failed to fetch mentions table data: ${error.message}`);
      }

      // Transform data for table display
      const tableData = (data || []).map((mention: any) => ({
        id: mention.id,
        source: mention.source_type,
        brand: mention.brands?.name || 'Unknown',
        content: mention.content,
        date: mention.published_at || mention.scraped_at,
        sentiment: mention.sentiment_analysis?.[0]?.sentiment || null,
        sentiment_score: mention.sentiment_analysis?.[0]?.confidence || null,
        author: mention.author,
        source_url: mention.source_url,
      }));

      return {
        data: tableData,
        total: count || 0,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch table data: ${error.message}`);
      throw new BadRequestException('Failed to fetch mentions table data');
    }
  }
}