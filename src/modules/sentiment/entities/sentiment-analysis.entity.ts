export interface SentimentAnalysis {
  id: string;
  mention_id: string;
  tenant_id: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  reasoning?: string;
  ai_model: string;
  ai_provider: string;
  analysis_version: string;
  created_at: string;
  updated_at: string;
  
  // Relations
  scraped_mention?: {
    id: string;
    content: string;
    brand_id: string;
    source_type: string;
  };
}