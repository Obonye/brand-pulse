import { IsOptional, IsDateString, IsEnum, IsUUID, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class AnalyticsQueryDto {
  @ApiPropertyOptional({ description: 'Brand ID to filter by' })
  @IsOptional()
  @IsUUID()
  brand_id?: string;

  @ApiPropertyOptional({ description: 'Source type to filter by (instagram, google_reviews, etc.)' })
  @IsOptional()
  source_type?: string;

  @ApiPropertyOptional({ description: 'Start date (ISO string)', example: '2024-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ description: 'End date (ISO string)', example: '2024-01-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({ 
    description: 'Time interval for grouping', 
    enum: ['day', 'week', 'month'],
    default: 'day'
  })
  @IsOptional()
  @IsEnum(['day', 'week', 'month'])
  interval?: 'day' | 'week' | 'month';
}

export class BrandComparisonQueryDto {
  @ApiPropertyOptional({ 
    description: 'Array of brand IDs to compare',
    type: [String],
    example: ['uuid1', 'uuid2']
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map(id => id.trim());
    }
    return value;
  })
  brand_ids?: string[];

  @ApiPropertyOptional({ description: 'Start date (ISO string)', example: '2024-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ description: 'End date (ISO string)', example: '2024-01-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  date_to?: string;
}

export class BasicAnalyticsQueryDto {
  @ApiPropertyOptional({ description: 'Brand ID to filter by' })
  @IsOptional()
  @IsUUID()
  brand_id?: string;

  @ApiPropertyOptional({ description: 'Start date (ISO string)', example: '2024-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ description: 'End date (ISO string)', example: '2024-01-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  date_to?: string;
}