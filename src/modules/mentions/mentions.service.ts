import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../shared/supabase/supabase.service';
import { ApifyService, ApifyDatasetItem } from '../shared/apify/apify.service';
import { SentimentService } from '../sentiment/sentiment.service';
import { AITaggingService } from '../ai-tagging/ai-tagging.service';
import { ScrapedMention } from './entities/mention.entity';
import { LoggerService } from '../../common/logger/logger.service';

@Injectable()
export class MentionsService {
  private logger: ReturnType<LoggerService['setContext']>;

  constructor(
    private supabaseService: SupabaseService,
    private apifyService: ApifyService,
    private sentimentService: SentimentService,
    private aiTaggingService: AITaggingService,
    private loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.setContext('MentionsService');
  }

  /**
   * Process and store mentions from completed Apify run
   */
  async processApifyRunData(scraperRun: any): Promise<void> {
    this.logger.info('Processing mentions from completed Apify run', {
      runId: scraperRun.id,
      apifyRunId: scraperRun.apify_run_id,
      tenantId: scraperRun.tenant_id,
      brandId: scraperRun.scraper_jobs?.brand_id,
      sourceType: scraperRun.scraper_jobs?.source_type
    });

    try {
      // Get Apify run data - use the actual apify_run_id field from database
      const apifyRunId = scraperRun.apify_run_id;
      if (!apifyRunId) {
        this.logger.error('No Apify run ID found in scraper run record', {
          runId: scraperRun.id,
          tenantId: scraperRun.tenant_id
        });
        throw new Error('No Apify run ID found in scraper run record');
      }

      // Fetch data from Apify
      const apifyData = await this.apifyService.getRunData(apifyRunId);
      this.logger.info('Retrieved data from Apify run', {
        apifyRunId,
        itemCount: apifyData.length,
        runId: scraperRun.id,
        tenantId: scraperRun.tenant_id
      });

      if (apifyData.length === 0) {
        this.logger.warn('No data found in Apify run', {
          apifyRunId,
          runId: scraperRun.id,
          tenantId: scraperRun.tenant_id
        });
        return;
      }

      // Transform and insert mentions
      const mentions = this.transformApifyDataToMentions(apifyData, scraperRun);
      this.logger.debug('Transformed Apify data to mentions', {
        originalCount: apifyData.length,
        validMentionsCount: mentions.length,
        runId: scraperRun.id,
        tenantId: scraperRun.tenant_id
      });

      const insertedMentions = await this.insertMentions(mentions);

      this.logger.info('Successfully processed mentions', {
        totalItems: apifyData.length,
        validMentions: mentions.length,
        insertedMentions: insertedMentions.length,
        duplicatesSkipped: mentions.length - insertedMentions.length,
        runId: scraperRun.id,
        tenantId: scraperRun.tenant_id
      });

      // Trigger sentiment analysis and AI tagging for newly inserted mentions
      if (insertedMentions.length > 0) {
        const brandName = scraperRun.scraper_jobs?.brands?.name;
        const brandId = scraperRun.scraper_jobs?.brand_id;
        
        this.logger.info('Triggering sentiment analysis and AI tagging', {
          mentionsCount: insertedMentions.length,
          brandName,
          brandId,
          runId: scraperRun.id,
          tenantId: scraperRun.tenant_id
        });
        
        // Trigger sentiment analysis
        this.triggerSentimentAnalysis(insertedMentions, brandName);
        
        // Trigger AI tagging
        this.triggerAITagging(insertedMentions, brandId, scraperRun.tenant_id);
      }

      // Update scraper run with processing stats
      await this.updateScraperRunStats(scraperRun.id, apifyData.length, insertedMentions.length);

    } catch (error) {
      this.logger.error('Failed to process Apify run data', {
        error: error.message,
        runId: scraperRun.id,
        tenantId: scraperRun.tenant_id,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Transform Apify data to mentions format
   */
  private transformApifyDataToMentions(apifyData: ApifyDatasetItem[], scraperRun: any): Partial<ScrapedMention>[] {
    const job = scraperRun.scraper_jobs;
    
    return apifyData.map((item, index) => {
      // Generate a source_id based on platform - use TikTok comment ID (cid) for TikTok comments
      let sourceId: string;
      if (job.source_type === 'tiktok_comments' || job.source_type === 'tiktok') {
        sourceId = item.cid || item.id || this.generateSourceId(item.videoWebUrl || item.url || '', index);
      } else {
        sourceId = item.id || item.reviewId || item.postId || 
                   this.generateSourceId(item.url || item.postUrl || item.title || '', index);
      }

      // Map fields based on platform
      let sourceUrl: string;
      let author: string;
      let authorUrl: string;
      let publishedAt: string | null;

      if (job.source_type === 'tiktok_comments' || job.source_type === 'tiktok') {
        sourceUrl = item.videoWebUrl || item.url;
        author = item.uniqueId || item.username;
        authorUrl = item.avatarThumbnail;
        publishedAt = this.parseDate(item.createTimeISO || item.createTime || item.timestamp || item.publishedAt || item.createdAt || item.date);
      } else {
        sourceUrl = item.postUrl || item.url;
        author = item.ownerUsername || item.author || item.reviewer || item.username;
        authorUrl = item.ownerProfilePicUrl || item.authorUrl || item.profileUrl;
        publishedAt = this.parseDate(item.timestamp || item.publishedAt || item.createdAt || item.date);
      }

      return {
        tenant_id: scraperRun.tenant_id,
        brand_id: job.brand_id,
        job_run_id: scraperRun.id,
        source_type: job.source_type,
        source_url: sourceUrl,
        source_id: sourceId,
        title: item.title || item.name,
        content: item.text || item.reviewText || item.content || item.description || '',
        author: author,
        author_url: authorUrl,
        author_followers: item.followers || item.followerCount,
        published_at: publishedAt || undefined,
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

      case 'tiktok':
      case 'tiktok_comments':
        return {
          ...baseMetadata,
          // TikTok comments specific fields
          video_web_url: item.videoWebUrl,
          comment_id: item.cid,
          create_time: item.createTime,
          create_time_iso: item.createTimeISO,
          digg_count: item.diggCount || 0, // likes on comment
          liked_by_author: item.likedByAuthor || false,
          pinned_by_author: item.pinnedByAuthor || false,
          replies_to_id: item.repliesToId,
          reply_comment_total: item.replyCommentTotal || 0,
          user_id: item.uid,
          unique_id: item.uniqueId, // username
          avatar_thumbnail: item.avatarThumbnail,
          mentions: item.mentions || [],
          detailed_mentions: item.detailedMentions || [],
          input: item.input, // original input (username/hashtag searched)
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
        this.logger.error('Failed to insert mentions', {
          error: error.message,
          mentionsCount: mentions.length,
          conflictColumn: 'tenant_id,source_type,source_id'
        });
        throw new BadRequestException(`Failed to insert mentions: ${error.message}`);
      }

      this.logger.debug('Successfully inserted mentions', {
        totalMentions: mentions.length,
        insertedCount: data?.length || 0
      });

      return data || [];
    } catch (error) {
      this.logger.error('Database error inserting mentions', {
        error: error.message,
        mentionsCount: mentions.length
      });
      throw error;
    }
  }

  /**
   * Trigger sentiment analysis for newly inserted mentions
   */
  private async triggerSentimentAnalysis(mentions: ScrapedMention[], brandName?: string): Promise<void> {
    try {
      this.logger.debug('Starting asynchronous sentiment analysis', {
        mentionsCount: mentions.length,
        brandName
      });
      
      // Run sentiment analysis asynchronously to avoid blocking the webhook response
      setImmediate(async () => {
        try {
          await this.sentimentService.batchAnalyzeMentions(mentions, brandName);
          this.logger.info('✅ SENTIMENT ANALYSIS COMPLETE', {
            mentionsCount: mentions.length,
            brandName,
            status: 'completed'
          });
        } catch (error) {
          this.logger.error('❌ SENTIMENT ANALYSIS FAILED', {
            error: error.message,
            mentionsCount: mentions.length,
            brandName,
            status: 'failed'
          });
        }
      });
    } catch (error) {
      this.logger.warn('Failed to trigger sentiment analysis', {
        error: error.message,
        mentionsCount: mentions.length,
        brandName
      });
    }
  }

  /**
   * Trigger AI tagging for newly inserted mentions
   */
  private async triggerAITagging(mentions: ScrapedMention[], brandId: string, tenantId: string): Promise<void> {
    try {
      this.logger.debug('Starting asynchronous AI tagging', {
        mentionsCount: mentions.length,
        brandId,
        tenantId
      });
      
      // Run AI tagging asynchronously to avoid blocking the webhook response
      setImmediate(async () => {
        try {
          const mentionIds = mentions.map(mention => mention.id);
          
          // Get brand details to determine industry context
          const { data: brand } = await this.supabaseService.adminClient
            .from('brands')
            .select('id, name, industry_id')
            .eq('id', brandId)
            .eq('tenant_id', tenantId)
            .single();

          const industryId = brand?.industry_id;

          this.logger.info('Starting bulk AI tagging process', {
            mentionsCount: mentionIds.length,
            brandName: brand?.name,
            industryId,
            tenantId
          });

          const result = await this.aiTaggingService.bulkTagMentions(
            mentionIds,
            tenantId,
            industryId,
            false // don't force retag
          );

          this.logger.info('🏷️ AI TAGGING COMPLETE', {
            mentionsCount: mentionIds.length,
            successful: result.success,
            failed: result.failed,
            successRate: mentionIds.length > 0 ? Math.round((result.success / mentionIds.length) * 100) : 0,
            brandName: brand?.name,
            tenantId,
            status: 'completed'
          });
        } catch (error) {
          this.logger.error('❌ AI TAGGING FAILED', {
            error: error.message,
            mentionsCount: mentions.length,
            brandId,
            tenantId,
            stack: error.stack,
            status: 'failed'
          });
        }
      });
    } catch (error) {
      this.logger.warn('Failed to trigger AI tagging', {
        error: error.message,
        mentionsCount: mentions.length,
        brandId,
        tenantId
      });
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
      this.logger.warn('Failed to update scraper run stats', {
        error: error.message,
        runId,
        totalItems,
        insertedItems
      });
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
        this.logger.error('Failed to fetch mentions table data', {
          error: error.message,
          tenantId,
          filters: { brand_id, source_type, sentiment, search, start_date, end_date },
          pagination: { page, limit, offset }
        });
        throw new BadRequestException(`Failed to fetch mentions table data: ${error.message}`);
      }

      // Transform data for table display
      const tableData = (data || []).map((mention: any) => ({
        id: mention.id,
        source: mention.source_type,
        brand: mention.brands?.name || 'Unknown',
        brand_id: mention.brands?.id || null,
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
      this.logger.error('Failed to fetch mentions table data', {
        error: error.message,
        tenantId,
        filters: options
      });
      throw new BadRequestException('Failed to fetch mentions table data');
    }
  }
}