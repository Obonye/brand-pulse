import { IsOptional, IsString, IsNumber, IsIn, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class MentionTableDto {
  id: string;
  source: string;
  brand: string;
  content: string;
  date: string;
  sentiment: 'positive' | 'negative' | 'neutral' | null;
  sentiment_score: number | null;
  author?: string;
  source_url?: string;
}

export class MentionsTableResponseDto {
  data: MentionTableDto[];
  total: number;
  page: number;
  limit: number;
}

export class GetMentionsTableQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  brand_id?: string;

  @IsOptional()
  @IsString()
  source_type?: string;

  @IsOptional()
  @IsIn(['positive', 'negative', 'neutral'])
  sentiment?: 'positive' | 'negative' | 'neutral';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;
}