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
    description: 'Configuration varies by source_type. For google_reviews use: startUrls (Google Maps URLs), placeIds (Google Place IDs), or searchStringsArray with locationQuery'
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

