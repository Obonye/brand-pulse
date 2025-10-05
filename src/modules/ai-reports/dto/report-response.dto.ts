import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportInsights, GeneratedReport } from '../interfaces/report-data.interface';

export class ReportResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenant_id: string;

  @ApiProperty()
  report_type: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  summary: string;

  @ApiProperty()
  insights: ReportInsights;

  @ApiProperty()
  metadata: {
    generatedAt: string;
    dateRange: string;
    aiModel: string;
    processingTime: number;
    confidenceThresholds: {
      tags: number;
      topics: number;
    };
    userId?: string;
    customInstructions?: string;
  };

  @ApiPropertyOptional()
  date_from?: string;

  @ApiPropertyOptional()
  date_to?: string;

  @ApiProperty()
  generated_at: string;

  @ApiPropertyOptional()
  created_at?: string;

  @ApiPropertyOptional()
  updated_at?: string;
}

export class ReportListResponseDto {
  @ApiProperty({ type: [ReportResponseDto] })
  reports: ReportResponseDto[];

  @ApiProperty()
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class GeneratedReportResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty()
  report: ReportResponseDto;

  @ApiProperty()
  processingTime: number;
}

export class ExportReportResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  filename: string;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  size: number;

  @ApiProperty()
  downloadUrl?: string;
}

export class ReportStatsDto {
  @ApiProperty()
  totalReports: number;

  @ApiProperty()
  reportsByType: Record<string, number>;

  @ApiProperty()
  reportsThisMonth: number;

  @ApiProperty()
  avgProcessingTime: number;

  @ApiPropertyOptional()
  lastGenerated: string | null;

  @ApiPropertyOptional()
  mostPopularType: string | null;
}

export class ScheduledReportDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenant_id: string;

  @ApiProperty()
  report_type: string;

  @ApiProperty()
  schedule_cron: string;

  @ApiProperty()
  is_active: boolean;

  @ApiProperty()
  email_recipients: string[];

  @ApiPropertyOptional()
  last_generated_at?: string;

  @ApiPropertyOptional()
  next_scheduled_at?: string | null;

  @ApiProperty()
  created_at: string;

  @ApiProperty()
  updated_at: string;
}