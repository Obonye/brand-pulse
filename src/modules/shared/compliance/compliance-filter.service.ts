import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../common/logger/logger.service';
import { ScrapedMention } from '../../mentions/entities/mention.entity';

export interface ComplianceResult<T> {
  anonymized: T;
  anonymizedFields: string[];
  preservedFields: string[];
}

@Injectable()
export class ComplianceFilterService {
  private logger: ReturnType<LoggerService['setContext']>;

  constructor(private loggerService: LoggerService) {
    this.logger = this.loggerService.setContext('ComplianceFilterService');
  }

  /**
   * Anonymize scraped mentions data for compliance
   * Preserve post authors, anonymize comment authors
   */
  anonymizeMentions(
    mentions: Partial<ScrapedMention>[]
  ): ComplianceResult<Partial<ScrapedMention>[]> {
    this.logger.info('Starting compliance anonymization of mentions', {
      mentionsCount: mentions.length,
    });

    const anonymizedMentions: Partial<ScrapedMention>[] = [];
    const allAnonymizedFields: string[] = [];
    const allPreservedFields: string[] = [];

    mentions.forEach((mention) => {
      const result = this.anonymizeMention(mention);
      anonymizedMentions.push(result.anonymized);
      allAnonymizedFields.push(...result.anonymizedFields);
      allPreservedFields.push(...result.preservedFields);
    });

    const uniqueAnonymizedFields = [...new Set(allAnonymizedFields)];
    const uniquePreservedFields = [...new Set(allPreservedFields)];

    this.logger.info('Completed compliance anonymization of mentions', {
      mentionsCount: mentions.length,
      anonymizedFields: uniqueAnonymizedFields,
      preservedFields: uniquePreservedFields,
    });

    return {
      anonymized: anonymizedMentions,
      anonymizedFields: uniqueAnonymizedFields,
      preservedFields: uniquePreservedFields,
    };
  }

  /**
   * Anonymize a single mention based on source type
   * Posts: preserve author data, Comments: anonymize author data
   */
  private anonymizeMention(
    mention: Partial<ScrapedMention>
  ): ComplianceResult<Partial<ScrapedMention>> {
    const anonymized = { ...mention };
    const anonymizedFields: string[] = [];
    const preservedFields: string[] = [];

    // Determine if this is a post (preserve author) or comment (anonymize author)
    const isPost = this.isPostType(mention.source_type || '');
    
    // PRESERVE: Essential data needed for analysis (always preserved)
    const alwaysPreserve = [
      'id', 'tenant_id', 'brand_id', 'job_run_id', 'source_type',
      'content', 'source_url', 'title',
      'published_at', 'scraped_at', 'created_at', 'updated_at', 
      'language'
    ];

    alwaysPreserve.forEach(field => {
      if (mention[field] !== undefined && mention[field] !== null) {
        preservedFields.push(field);
      }
    });

    // Handle author data based on post vs comment
    if (mention.author) {
      if (isPost) {
        // PRESERVE: Post author data (content creators)
        preservedFields.push('author');
      } else {
        // ANONYMIZE: Comment author data (third-party commenters)
        anonymized.author = this.generateAnonymousAuthor();
        anonymizedFields.push('author');
      }
    }

    if (mention.author_url) {
      if (isPost) {
        // PRESERVE: Post author profile URLs
        preservedFields.push('author_url');
      } else {
        // REMOVE: Comment author profile URLs
        anonymized.author_url = undefined;
        anonymizedFields.push('author_url');
      }
    }

    if (mention.author_followers !== undefined && mention.author_followers !== null) {
      if (isPost) {
        // PRESERVE: Post author follower counts for analytics
        preservedFields.push('author_followers');
      } else {
        // ANONYMIZE: Comment author follower counts
        anonymized.author_followers = undefined;
        anonymizedFields.push('author_followers');
      }
    }

    if (mention.source_id) {
      // Keep source_id but make it anonymous while maintaining uniqueness
      anonymized.source_id = this.anonymizeSourceId(mention.source_id);
      anonymizedFields.push('source_id');
    }

    // ANONYMIZE: Metadata - remove personal info but keep analytics data
    if (mention.metadata) {
      anonymized.metadata = this.anonymizeMetadata(mention.metadata, isPost);
      anonymizedFields.push('metadata');
    }

    return {
      anonymized,
      anonymizedFields,
      preservedFields,
    };
  }

  /**
   * Determine if source type represents a post (preserve author) or comment (anonymize author)
   */
  private isPostType(sourceType: string): boolean {
    // Post types - preserve author data (content creators)
    const postTypes = [
      'instagram_posts',
      'tiktok', 
      'youtube_videos',
      'facebook_posts',
      'twitter_posts'
    ];
    
    // Comment/Review types - anonymize author data (third-party commenters)
    const commentTypes = [
      'instagram_comments',
      'tiktok_comments', 
      'google_reviews',
      'youtube_comments',
      'facebook_comments',
      'twitter_replies'
    ];
    
    return postTypes.includes(sourceType);
  }

  /**
   * Generate anonymous author identifier
   */
  private generateAnonymousAuthor(): string {
    // Generate a random anonymous identifier that's still unique-looking
    const adjectives = ['Anonymous', 'Private', 'Guest', 'User'];
    const randomNum = Math.floor(Math.random() * 10000);
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    
    return `${randomAdjective}_${randomNum}`;
  }

  /**
   * Anonymize source ID while maintaining uniqueness for deduplication
   */
  private anonymizeSourceId(sourceId: string): string {
    // Create a hash that's consistent but not reversible
    let hash = 0;
    for (let i = 0; i < sourceId.length; i++) {
      const char = sourceId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `anon_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Anonymize metadata while preserving analytics-relevant data
   */
  private anonymizeMetadata(metadata: Record<string, any>, isPost: boolean): Record<string, any> {
    const anonymizedMetadata = { ...metadata };

    // PRESERVE: Numerical and boolean analytics data
    const analyticsFields = [
      'rating', 'stars', 'likes', 'shares', 'replies', 'likeCount', 'shareCount', 'replyCount',
      'likes_count', 'comments_count', 'video_play_count', 'video_view_count',
      'is_sponsored', 'video_duration', 'review_rating', 'digg_count', 'reply_comment_total',
      'liked_by_author', 'pinned_by_author', 'is_verified', 'follower_count', 'followers',
      'comment_replies_count', 'comment_likes_count', 'create_time', 'create_time_iso',
      'hashtags', 'location_id', 'product_type', 'post_type', 'mentions'
    ];

    // Handle personal identifying fields based on post vs comment
    const personalFields = [
      'business_name', 'business_address', 'owner_username', 'owner_full_name',
      'reviewer_name', 'unique_id', 'video_web_url', 'avatar_thumbnail',
      'owner_profile_pic', 'location_name', 'review_response', 'short_code',
      'owner_id', 'user_id', 'detailed_mentions'
    ];

    // For posts, preserve some author-related fields, for comments remove them all
    const fieldsToRemove = isPost 
      ? personalFields.filter(field => !['owner_username', 'owner_full_name', 'owner_id'].includes(field))
      : personalFields;

    // Remove personal identifying fields
    fieldsToRemove.forEach(field => {
      if (anonymizedMetadata[field]) {
        delete anonymizedMetadata[field];
      }
    });

    // Clean up platform_data recursively
    if (anonymizedMetadata.platform_data && typeof anonymizedMetadata.platform_data === 'object') {
      anonymizedMetadata.platform_data = this.cleanPlatformData(anonymizedMetadata.platform_data, isPost);
    }

    return anonymizedMetadata;
  }

  /**
   * Clean platform data to remove personal information
   */
  private cleanPlatformData(platformData: Record<string, any>, isPost: boolean = false): Record<string, any> {
    const cleaned = { ...platformData };
    
    // Remove common personal identifier fields from platform data
    const personalFields = [
      'username', 'uniqueId', 'ownerUsername', 'author', 'reviewer',
      'ownerProfilePicUrl', 'avatarThumbnail', 'profileUrl', 'authorUrl',
      'ownerFullName', 'businessName', 'reviewerName', 'videoWebUrl',
      'shortCode', 'ownerId', 'userId', 'uid'
    ];

    // For posts, preserve some author fields, for comments remove all
    const fieldsToClean = isPost
      ? personalFields.filter(field => !['ownerUsername', 'ownerFullName', 'ownerId'].includes(field))
      : personalFields;

    fieldsToClean.forEach(field => {
      if (cleaned[field]) {
        delete cleaned[field];
      }
    });

    return cleaned;
  }

  /**
   * Get anonymization statistics for reporting
   */
  getAnonymizationStats(results: ComplianceResult<any>): {
    fieldsAnonymized: number;
    fieldsPreserved: number;
    anonymizationRate: number;
    summary: string;
  } {
    const totalFields = results.anonymizedFields.length + results.preservedFields.length;
    const anonymizationRate = totalFields > 0 ? (results.anonymizedFields.length / totalFields) * 100 : 0;

    return {
      fieldsAnonymized: results.anonymizedFields.length,
      fieldsPreserved: results.preservedFields.length,
      anonymizationRate: Math.round(anonymizationRate * 100) / 100,
      summary: `Preserved post authors and content, anonymized comment authors`,
    };
  }
}