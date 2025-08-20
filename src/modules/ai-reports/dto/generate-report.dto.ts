import { IsString, IsOptional, IsArray, IsNumber, IsBoolean, IsDateString, IsEnum, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ReportType {
  EXECUTIVE_SUMMARY = 'executive-summary',
  SENTIMENT_INTELLIGENCE = 'sentiment-intelligence',
  COMPETITIVE_ANALYSIS = 'competitive-analysis',
  CATEGORY_PERFORMANCE = 'category-performance',
  CRISIS_ALERT = 'crisis-alert',
  TREND_ANALYSIS = 'trend-analysis'
}

export class GenerateReportDto {
  @ApiProperty({
    enum: ReportType,
    description: 'Type of report to generate'
  })
  @IsEnum(ReportType)
  reportType: ReportType;

  @ApiPropertyOptional({
    description: 'Start date for report data (ISO string)',
    example: '2024-01-01T00:00:00Z'
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for report data (ISO string)',
    example: '2024-01-31T23:59:59Z'
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Array of brand IDs to include in report',
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  brandIds?: string[];

  @ApiPropertyOptional({
    description: 'Array of source types to include',
    type: [String],
    example: ['twitter', 'facebook', 'instagram']
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sourceTypes?: string[];

  @ApiPropertyOptional({
    description: 'Maximum number of mentions to analyze',
    minimum: 1,
    maximum: 5000,
    default: 1000
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5000)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Minimum confidence threshold for AI tags (0.0-1.0)',
    minimum: 0,
    maximum: 1,
    default: 0.7
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minTagConfidence?: number;

  @ApiPropertyOptional({
    description: 'Minimum confidence threshold for topics (0.0-1.0)',
    minimum: 0,
    maximum: 1,
    default: 0.6
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minTopicConfidence?: number;

  @ApiPropertyOptional({
    description: 'Custom title for the report'
  })
  @IsOptional()
  @IsString()
  customTitle?: string;

  @ApiPropertyOptional({
    description: 'Whether this is an automated report generation',
    default: false
  })
  @IsOptional()
  @IsBoolean()
  automated?: boolean;
}