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

/**
 * Simplified mention data for storing in insights (to reduce JSON size)
 */
export interface SimplifiedMention {
  content: string;
  author: string;
  source_type: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  sentiment_confidence: number;
  max_urgency_score?: number;
  published_at?: string;
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

/**
 * Streamlined insights containing only essential data for AI reports
 * Focused on 6 key elements: summary, recommendations, metrics, sentiment, sources, topics
 */
export interface StreamlinedInsights {
  // Key Metrics
  totalMentions: number;
  dateRange: { from: string; to: string };
  confidenceThresholds: {
    tags: number;
    topics: number;
  };

  // Sentiment Breakdown
  sentimentBreakdown: {
    positive: number;
    negative: number;
    neutral: number;
    avgConfidence: number;
  };

  // Top Sources and Topics (essential aggregated data)
  topSourceTypes: TopItem[];
  topTopics: TopItem[];
}

/**
 * Legacy interface - kept for backwards compatibility during transition
 * @deprecated Use StreamlinedInsights instead for new reports
 */
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

  // Sample mentions for context (simplified to reduce JSON size)
  highPriorityMentions: SimplifiedMention[];
  positiveMentions: SimplifiedMention[];
  negativeMentions: SimplifiedMention[];

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

// New structured AI content interface
export interface AIReportContent {
  summary: string;
  content: string;
  keyFindings: string[];
  recommendations: string[];
}

// Enhanced metadata interface
export interface ReportMetadata {
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
}

// Complete structured report data (what gets returned to frontend)
export interface StructuredReportData {
  title: string;
  reportType: string;
  insights: ReportInsights;
  aiContent: AIReportContent;
  metadata: ReportMetadata;
  data: {
    mentions: MentionReportData[]; // Limited subset for JSON size
    stats: MentionSummaryStats;
  };
}

// Database stored report (with JSON content)
export interface GeneratedReport {
  id: string;
  tenant_id: string;
  report_type: string;
  title: string;
  content: string; // JSON stringified StructuredReportData
  summary: string;
  insights: ReportInsights;
  metadata: ReportMetadata;
  date_from?: string;
  date_to?: string;
  generated_at: string;
  created_at?: string;
  updated_at?: string;
  exports?: Record<string, any>;
  processingStats?: {
    totalTime: number;
    aiTime: number;
    tokensUsed: number;
    mentionsProcessed: number;
    model: string;
  };
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