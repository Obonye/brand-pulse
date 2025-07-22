import { IsOptional, IsString, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ScrapedPostsQueryDto {
  @ApiPropertyOptional({ description: 'Brand ID to filter posts' })
  @IsOptional()
  @IsString()
  brand_id?: string;

  @ApiPropertyOptional({ description: 'Source type (e.g., instagram, facebook)', enum: ['instagram', 'facebook', 'tiktok'] })
  @IsOptional()
  @IsEnum(['instagram', 'facebook', 'tiktok'])
  source_type?: string;

  @ApiPropertyOptional({ description: 'Post type filter', enum: ['image', 'video', 'carousel'] })
  @IsOptional()
  @IsEnum(['image', 'video', 'carousel'])
  post_type?: string;

  @ApiPropertyOptional({ description: 'Number of posts to return', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Number of posts to skip', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ description: 'Start date for filtering posts (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  start_date?: string;

  @ApiPropertyOptional({ description: 'End date for filtering posts (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  end_date?: string;
}