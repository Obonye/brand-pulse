import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../shared/supabase/supabase.service';
import { ApifyService, ApifyDatasetItem } from '../shared/apify/apify.service';
import { ScrapedMention } from './entities/mention.entity';

@Injectable()
export class MentionsService {
  private readonly logger = new Logger(MentionsService.name);

  constructor(
    private supabaseService: SupabaseService,
    private apifyService: ApifyService,
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
      const insertedCount = await this.insertMentions(mentions);

      this.logger.log(`Successfully inserted ${insertedCount} mentions for run ${scraperRun.id}`);

      // Update scraper run with processing stats
      await this.updateScraperRunStats(scraperRun.id, apifyData.length, insertedCount);

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
  private async insertMentions(mentions: Partial<ScrapedMention>[]): Promise<number> {
    if (mentions.length === 0) return 0;

    try {
      // Insert with ON CONFLICT handling for duplicates
      const { data, error } = await this.supabaseService.adminClient
        .from('scraped_mentions')
        .upsert(mentions, { 
          onConflict: 'tenant_id,source_type,source_id',
          ignoreDuplicates: false 
        })
        .select('id');

      if (error) {
        this.logger.error(`Failed to insert mentions: ${error.message}`);
        throw new BadRequestException(`Failed to insert mentions: ${error.message}`);
      }

      return data?.length || 0;
    } catch (error) {
      this.logger.error(`Database error inserting mentions: ${error.message}`);
      throw error;
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
}