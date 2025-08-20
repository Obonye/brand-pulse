import { ReportInsights } from '../interfaces/report-data.interface';

/**
 * AI Reports entity representing the ai_reports table
 */
export interface AiReportEntity {
  id: string;
  tenant_id: string;
  report_type: string;
  title: string;
  content: string;
  summary: string;
  insights: ReportInsights;
  metadata: {
    dateRange: string;
    generatedAt: string;
    confidenceThreshold: number;
    aiModel: string;
    processingTime: number;
    tokensUsed?: number;
    userId?: string;
    customInstructions?: string;
  };
  date_from: string | null;
  date_to: string | null;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * AI Report creation data (for inserts)
 */
export interface CreateAiReportData {
  tenant_id: string;
  report_type: string;
  title: string;
  content: string;
  summary: string;
  insights: ReportInsights;
  metadata: {
    dateRange: string;
    generatedAt: string;
    confidenceThreshold: number;
    aiModel: string;
    processingTime: number;
    tokensUsed?: number;
    userId?: string;
    customInstructions?: string;
  };
  date_from?: string | null;
  date_to?: string | null;
  generated_at: string;
}

/**
 * AI Report update data (for updates)
 */
export interface UpdateAiReportData {
  title?: string;
  content?: string;
  summary?: string;
  insights?: ReportInsights;
  metadata?: {
    dateRange?: string;
    generatedAt?: string;
    confidenceThreshold?: number;
    aiModel?: string;
    processingTime?: number;
    tokensUsed?: number;
    userId?: string;
    customInstructions?: string;
  };
  updated_at?: string;
}

/**
 * AI Report query filters
 */
export interface AiReportQueryFilters {
  tenant_id: string;
  report_type?: string;
  date_from?: string;
  date_to?: string;
  generated_after?: string;
  generated_before?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sort_by?: 'generated_at' | 'title' | 'report_type' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

/**
 * Report type enum based on implementation
 */
export enum ReportType {
  EXECUTIVE_SUMMARY = 'executive-summary',
  SENTIMENT_INTELLIGENCE = 'sentiment-intelligence',
  COMPETITIVE_ANALYSIS = 'competitive-analysis',
  CATEGORY_PERFORMANCE = 'category-performance',
  CRISIS_ALERT = 'crisis-alert',
  TREND_ANALYSIS = 'trend-analysis'
}

/**
 * Report status enum
 */
export enum ReportStatus {
  PENDING = 'pending',
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Report processing metadata
 */
export interface ReportProcessingMetadata {
  startTime: number;
  endTime?: number;
  totalTime?: number;
  dataFetchTime?: number;
  aiProcessingTime?: number;
  templateRenderTime?: number;
  pdfGenerationTime?: number;
  mentionsProcessed?: number;
  tokensUsed?: number;
  model?: string;
  errors?: string[];
  warnings?: string[];
}