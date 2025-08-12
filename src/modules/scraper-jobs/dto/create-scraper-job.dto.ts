import { IsString, IsEnum, IsOptional, IsObject, IsUUID, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum SourceType {
  GOOGLE_REVIEWS = 'google_reviews',
  FACEBOOK = 'facebook',
  INSTAGRAM = 'instagram',
  TWITTER = 'twitter',
  LINKEDIN = 'linkedin',
  TRIPADVISOR = 'tripadvisor',
  BOOKING_COM = 'booking_com',
  NEWS_SITES = 'news_sites',
  FORUMS = 'forums',
  YOUTUBE = 'youtube',
  TIKTOK = 'tiktok',
  TIKTOK_COMMENTS = 'tiktok_comments',
}

export class CreateScraperJobDto {
  @ApiProperty({ example: 'Hotel Reviews Monitor' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  brand_id: string;

  @ApiProperty({ enum: SourceType, example: SourceType.GOOGLE_REVIEWS })
  @IsEnum(SourceType)
  source_type: SourceType;

  @ApiProperty({
    example: {
      startUrls: ['https://maps.app.goo.gl/QChxVcDM6NbeosKr5'],
      max_results: 50,
      sort: 'newest',
      language: 'en'
    },
    description: `Configuration varies by source_type:
    - google_reviews: startUrls (Google Maps URLs), placeIds, or searchStringsArray with locationQuery
    - instagram: usernames (["username1", "username2"]), hashtags (["hashtag1"]), or locations (["location_id"])
    - booking_com: startUrls with hotel URLs or search_query
    - facebook: page_urls array
    - tiktok: profiles (["username1", "username2"]), hashtags (["hashtag1"]), videos (video URLs), or search_query. Optional: comments_per_post, results_per_page, profile_sorting ("latest"/"oldest"/"popular")
    - tiktok_comments: video_urls (["https://tiktok.com/@user/video/123"]), startUrls, or profiles (["username1"]). Optional: comments_per_post, exclude_pinned_posts, max_replies_per_comment, results_per_page, profile_scrape_sections, profile_sorting
    - All: max_results to limit results`
  })
  @IsObject()
  config: Record<string, any>;

  @ApiProperty({ 
    example: '0 */6 * * *',
    description: 'Cron expression for scheduling',
    required: false 
  })
  @IsOptional()
  @IsString()
  schedule_cron?: string;
}

