/**
 * Interfaces for AI Reports data structures
 * Based on RPC function responses from ai-reports-rpc-final.md
 */

export interface MentionReportData {
  mention_id: string;
  content: string;
  author: string;
  published_at: string;
  scraped_at: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentiment_confidence: number;
  brand_name: string;
  brand_id: string;
  source_type: string;
  source_url: string;
  title: string;
  tags: AITag[];
  topics: AITopic[];
  max_priority: 'low' | 'medium' | 'high';
  max_urgency_score: number;
  author_followers: number;
  metadata: Record<string, any>;
}

export interface AITag {
  category: string;
  category_display: string;
  intent: string;
  intent_display: string;
  priority: 'low' | 'medium' | 'high';
  urgency_score: number;
  ai_model: string;
}

export interface AITopic {
  name: string;
}

export interface MentionSummaryStats {
  total_mentions: number;
  sentiment_positive: number;
  sentiment_negative: number;
  sentiment_neutral: number;
  avg_sentiment_confidence: number;
  high_priority_count: number;
  medium_priority_count: number;
  low_priority_count: number;
  avg_urgency_score: number;
  unique_authors: number;
  top_source_types: TopItem[];
  top_categories: TopItem[];
  top_topics: TopItem[];
}

export interface TopItem {
  source_type?: string;
  category?: string;
  topic?: string;
  count: number;
}

export interface ReportInsights {
  // Pre-calculated summary metrics from RPC
  totalMentions: number;
  sentimentBreakdown: {
    positive: number;
    negative: number;
    neutral: number;
    avgConfidence: number;
  };
  priorityBreakdown: {
    high: number;
    medium: number;
    low: number;
    avgUrgency: number;
  };
  // Pre-aggregated top items from RPC
  topCategories: TopItem[];
  topTopics: TopItem[];
  topSourceTypes: TopItem[];
  uniqueAuthors: number;

  // Sample mentions for context
  highPriorityMentions: MentionReportData[];
  positiveMentions: MentionReportData[];
  negativeMentions: MentionReportData[];

  // Configuration and metadata
  dateRange: { from: string; to: string };
  confidenceThresholds: {
    tags: number;
    topics: number;
  };
}

export interface ReportOptions {
  startDate?: string;
  endDate?: string;
  brandIds?: string[];
  sourceTypes?: string[];
  limit?: number;
  minTagConfidence?: number;
  minTopicConfidence?: number;
  automated?: boolean;
}

export interface GeneratedReport {
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
  };
  date_from: string;
  date_to: string;
  generated_at: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  type: string;
  prompt_template: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScheduledReport {
  id: string;
  tenant_id: string;
  report_type: string;
  schedule_cron: string;
  is_active: boolean;
  email_recipients: string[];
  last_generated_at?: string;
  next_scheduled_at?: string;
  created_at: string;
  updated_at: string;
}