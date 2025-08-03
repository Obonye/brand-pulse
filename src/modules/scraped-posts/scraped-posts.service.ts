import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../shared/supabase/supabase.service';
import { CreateScrapedPostData, ScrapedPost } from './entities/scraped-post.entity';
import { LoggerService } from '../../common/logger/logger.service';

@Injectable()
export class ScrapedPostsService {
  private logger: ReturnType<LoggerService['setContext']>;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.setContext('ScrapedPostsService');
  }

  async createScrapedPost(postData: CreateScrapedPostData): Promise<ScrapedPost | null> {
    try {
      const { data, error } = await this.supabaseService.adminClient
        .from('scraped_posts')
        .insert(postData)
        .select()
        .single();

      if (error) {
        this.logger.error(`Failed to create scraped post: ${error.message}`);
        return null;
      }

      return data;
    } catch (error) {
      this.logger.error(`Error creating scraped post: ${error.message}`);
      return null;
    }
  }

  async upsertScrapedPost(postData: CreateScrapedPostData): Promise<ScrapedPost | null> {
    try {
      const { data, error } = await this.supabaseService.adminClient
        .from('scraped_posts')
        .upsert(postData, {
          onConflict: 'source_type,source_post_id',
        })
        .select()
        .single();

      if (error) {
        this.logger.error(`Failed to upsert scraped post: ${error.message}`);
        return null;
      }

      return data;
    } catch (error) {
      this.logger.error(`Error upserting scraped post: ${error.message}`);
      return null;
    }
  }

  async processInstagramPostsData(
    postsData: any[],
    tenantId: string,
    brandId: string
  ): Promise<ScrapedPost[]> {
    this.logger.info('Starting Instagram posts processing', {
      tenantId,
      brandId,
      totalPosts: postsData.length,
      sourceType: 'instagram'
    });

    const processedPosts: ScrapedPost[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const postData of postsData) {
      try {
        const scrapedPost = await this.transformInstagramPost(postData, tenantId, brandId);
        if (scrapedPost) {
          const created = await this.upsertScrapedPost(scrapedPost);
          if (created) {
            processedPosts.push(created);
            successCount++;
            
            this.logger.debug('Instagram post processed successfully', {
              tenantId,
              brandId,
              sourcePostId: scrapedPost.source_post_id,
              postType: scrapedPost.post_type,
              likesCount: scrapedPost.likes_count,
              commentsCount: scrapedPost.comments_count
            });
          } else {
            failedCount++;
            this.logger.warn('Failed to upsert Instagram post', {
              tenantId,
              brandId,
              sourcePostId: scrapedPost.source_post_id
            });
          }
        } else {
          failedCount++;
          this.logger.warn('Failed to transform Instagram post data', {
            tenantId,
            brandId,
            postDataKeys: Object.keys(postData || {})
          });
        }
      } catch (error) {
        failedCount++;
        this.logger.error('Error processing Instagram post', {
          error: error.message,
          tenantId,
          brandId,
          postDataId: postData?.id || postData?.shortCode
        });
      }
    }

    this.logger.info('Instagram posts processing completed', {
      tenantId,
      brandId,
      totalPosts: postsData.length,
      successfullyProcessed: successCount,
      failed: failedCount,
      successRate: postsData.length > 0 ? Math.round((successCount / postsData.length) * 100) : 0
    });

    return processedPosts;
  }

  private async transformInstagramPost(
    postData: any,
    tenantId: string,
    brandId: string
  ): Promise<CreateScrapedPostData | null> {
    try {
      // Extract post ID - prioritize shortCode, then extract from URL, fallback to id
      const sourcePostId = postData.shortCode || 
        (postData.url && postData.url.match(/\/p\/([^\/]+)\//)?.[1]) ||
        postData.id;

      if (!sourcePostId) {
        this.logger.warn('No source post ID found for Instagram post');
        return null;
      }

      // Determine post type based on Instagram data structure
      let postType = 'image'; // default
      if (postData.type === 'Image') {
        postType = 'image';
      } else if (postData.type === 'Video') {
        postType = 'video';
      } else if (postData.type === 'Sidecar') {
        postType = 'carousel';
      }

      // Use hashtags array from data if available, otherwise extract from caption
      const hashtags = postData.hashtags && postData.hashtags.length > 0 
        ? postData.hashtags 
        : postData.caption ? 
          (postData.caption.match(/#[\w]+/g) || []).map((tag: string) => tag.substring(1)) : 
          [];

      // Use mentions array from data if available, otherwise extract from caption
      const mentionedUsers = postData.mentions && postData.mentions.length > 0 
        ? postData.mentions 
        : postData.caption ? 
          (postData.caption.match(/@[\w.]+/g) || []).map((mention: string) => mention.substring(1)) : 
          [];

      // Parse timestamp - handle both Unix timestamp and ISO string
      let publishedAt: string | null = null;
      if (postData.timestamp) {
        // Check if it's already an ISO string or Unix timestamp
        if (typeof postData.timestamp === 'string') {
          publishedAt = new Date(postData.timestamp).toISOString();
        } else {
          publishedAt = new Date(postData.timestamp * 1000).toISOString();
        }
      } else if (postData.takenAt) {
        publishedAt = new Date(postData.takenAt).toISOString();
      }

      // Extract image URLs for UI display
      const displayUrl = postData.displayUrl;
      let imageUrls: string[] = [];
      
      if (postData.images && postData.images.length > 0) {
        // Carousel post with multiple images
        imageUrls = postData.images;
      } else if (displayUrl) {
        // Single image post
        imageUrls = [displayUrl];
      }

      // Also collect child post images for carousels
      if (postData.childPosts && postData.childPosts.length > 0) {
        const childImages = postData.childPosts
          .map((child: any) => child.displayUrl)
          .filter((url: string) => url);
        
        // Merge with existing images, removing duplicates
        imageUrls = [...new Set([...imageUrls, ...childImages])];
      }

      return {
        tenant_id: tenantId,
        brand_id: brandId,
        source_type: 'instagram',
        source_post_id: sourcePostId,
        post_url: postData.url || `https://www.instagram.com/p/${sourcePostId}/`,
        caption: postData.caption,
        post_type: postType,
        hashtags,
        mentioned_users: mentionedUsers,
        likes_count: postData.likesCount || 0,
        comments_count: postData.commentsCount || 0,
        views_count: postData.videoViewCount || 0,
        shares_count: 0, // Instagram doesn't provide shares count
        author_username: postData.ownerUsername,
        author_follower_count: postData.ownerFollowersCount || null,
        display_url: displayUrl,
        image_urls: imageUrls,
        metadata: {
          original_data: postData,
          location_name: postData.locationName,
          location_id: postData.locationId,
          owner_full_name: postData.ownerFullName,
          owner_id: postData.ownerId,
          is_sponsored: postData.isSponsored,
          is_pinned: postData.isPinned,
          is_comments_disabled: postData.isCommentsDisabled,
          dimensions: {
            height: postData.dimensionsHeight,
            width: postData.dimensionsWidth
          },
          alt_text: postData.alt,
          child_posts: postData.childPosts?.length || 0,
          input_url: postData.inputUrl,
        },
        published_at: publishedAt ?? undefined,
      };
    } catch (error) {
      this.logger.error(`Error transforming Instagram post: ${error.message}`);
      return null;
    }
  }

  async getScrapedPosts(
    tenantId: string,
    query: {
      brand_id?: string;
      source_type?: string;
      post_type?: string;
      limit?: number;
      offset?: number;
      start_date?: string;
      end_date?: string;
    }
  ): Promise<{ data: ScrapedPost[]; total: number }> {
    const limit = query.limit || 20;
    const offset = query.offset || 0;

    this.logger.info('Fetching scraped posts with filters', {
      tenantId,
      filters: {
        brandId: query.brand_id,
        sourceType: query.source_type,
        postType: query.post_type,
        hasDateRange: !!(query.start_date || query.end_date)
      },
      pagination: { limit, offset }
    });

    try {
      let supabaseQuery = this.supabaseService.adminClient
        .from('scraped_posts')
        .select('*, brands!inner(name)', { count: 'exact' })
        .eq('tenant_id', tenantId);

      // Apply filters
      if (query.brand_id) {
        supabaseQuery = supabaseQuery.eq('brand_id', query.brand_id);
      }

      if (query.source_type) {
        supabaseQuery = supabaseQuery.eq('source_type', query.source_type);
      }

      if (query.post_type) {
        supabaseQuery = supabaseQuery.eq('post_type', query.post_type);
      }

      if (query.start_date) {
        supabaseQuery = supabaseQuery.gte('published_at', `${query.start_date}T00:00:00Z`);
      }

      if (query.end_date) {
        supabaseQuery = supabaseQuery.lte('published_at', `${query.end_date}T23:59:59Z`);
      }

      // Apply pagination and ordering
      supabaseQuery = supabaseQuery
        .order('published_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await supabaseQuery;

      if (error) {
        this.logger.error('Failed to fetch scraped posts from database', {
          error: error.message,
          tenantId,
          filters: query
        });
        return { data: [], total: 0 };
      }

      // Transform data to flatten brands relationship
      const transformedData = (data || []).map(post => ({
        ...post,
        brand_name: post.brands?.name,
        brands: undefined
      }));

      this.logger.info('Scraped posts retrieved successfully', {
        tenantId,
        totalRecords: count || 0,
        returnedRecords: transformedData.length,
        pagination: { limit, offset },
        hasFilters: !!(query.brand_id || query.source_type || query.post_type || query.start_date || query.end_date)
      });

      return { 
        data: transformedData, 
        total: count || 0 
      };
    } catch (error) {
      this.logger.error('Error in getScrapedPosts method', {
        error: error.message,
        tenantId,
        query
      });
      return { data: [], total: 0 };
    }
  }

  async getScrapedPostsByBrand(brandId: string, tenantId: string): Promise<ScrapedPost[]> {
    try {
      const { data, error } = await this.supabaseService.adminClient
        .from('scraped_posts')
        .select('*')
        .eq('brand_id', brandId)
        .eq('tenant_id', tenantId)
        .order('published_at', { ascending: false });

      if (error) {
        this.logger.error(`Failed to get scraped posts: ${error.message}`);
        return [];
      }

      return data || [];
    } catch (error) {
      this.logger.error(`Error getting scraped posts: ${error.message}`);
      return [];
    }
  }

  async getScrapedPostsStats(
    tenantId: string,
    query: {
      brand_id?: string;
      source_type?: string;
      start_date?: string;
      end_date?: string;
    }
  ): Promise<{
    total_posts: number;
    by_source: Record<string, number>;
    by_post_type: Record<string, number>;
    by_brand: Record<string, number>;
    engagement_stats: {
      total_likes: number;
      total_comments: number;
      avg_likes: number;
      avg_comments: number;
    };
  }> {
    try {
      let baseQuery = this.supabaseService.adminClient
        .from('scraped_posts')
        .select('source_type, post_type, brand_id, likes_count, comments_count')
        .eq('tenant_id', tenantId);

      // Apply filters
      if (query.brand_id) {
        baseQuery = baseQuery.eq('brand_id', query.brand_id);
      }

      if (query.source_type) {
        baseQuery = baseQuery.eq('source_type', query.source_type);
      }

      if (query.start_date) {
        baseQuery = baseQuery.gte('published_at', `${query.start_date}T00:00:00Z`);
      }

      if (query.end_date) {
        baseQuery = baseQuery.lte('published_at', `${query.end_date}T23:59:59Z`);
      }

      const { data, error } = await baseQuery;

      if (error) {
        this.logger.error(`Failed to get scraped posts stats: ${error.message}`);
        return {
          total_posts: 0,
          by_source: {},
          by_post_type: {},
          by_brand: {},
          engagement_stats: {
            total_likes: 0,
            total_comments: 0,
            avg_likes: 0,
            avg_comments: 0,
          },
        };
      }

      const posts = data || [];
      const totalPosts = posts.length;

      // Group by source type
      const bySource: Record<string, number> = {};
      const byPostType: Record<string, number> = {};
      const byBrand: Record<string, number> = {};

      let totalLikes = 0;
      let totalComments = 0;

      posts.forEach(post => {
        // Count by source
        bySource[post.source_type] = (bySource[post.source_type] || 0) + 1;
        
        // Count by post type
        if (post.post_type) {
          byPostType[post.post_type] = (byPostType[post.post_type] || 0) + 1;
        }
        
        // Count by brand
        byBrand[post.brand_id] = (byBrand[post.brand_id] || 0) + 1;
        
        // Sum engagement
        totalLikes += post.likes_count || 0;
        totalComments += post.comments_count || 0;
      });

      return {
        total_posts: totalPosts,
        by_source: bySource,
        by_post_type: byPostType,
        by_brand: byBrand,
        engagement_stats: {
          total_likes: totalLikes,
          total_comments: totalComments,
          avg_likes: totalPosts > 0 ? Math.round(totalLikes / totalPosts) : 0,
          avg_comments: totalPosts > 0 ? Math.round(totalComments / totalPosts) : 0,
        },
      };
    } catch (error) {
      this.logger.error(`Error getting scraped posts stats: ${error.message}`);
      return {
        total_posts: 0,
        by_source: {},
        by_post_type: {},
        by_brand: {},
        engagement_stats: {
          total_likes: 0,
          total_comments: 0,
          avg_likes: 0,
          avg_comments: 0,
        },
      };
    }
  }

  async getScrapedPostById(id: string, tenantId: string): Promise<ScrapedPost | null> {
    try {
      const { data, error } = await this.supabaseService.adminClient
        .from('scraped_posts')
        .select('*, brands!inner(name)')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        this.logger.error(`Failed to get scraped post by ID: ${error.message}`);
        return null;
      }

      if (!data) {
        return null;
      }

      // Transform data to flatten brands relationship
      return {
        ...data,
        brand_name: data.brands?.name,
        brands: undefined
      };
    } catch (error) {
      this.logger.error(`Error getting scraped post by ID: ${error.message}`);
      return null;
    }
  }
}