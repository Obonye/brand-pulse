export interface MentionTag {
  id: string;
  mention_id: string;
  tenant_id: string;
  category_id: string;
  intent_id: string;
  priority: 'low' | 'medium' | 'high';
  urgency_score: number;
  confidence: number;
  ai_model: string;
  ai_provider: string;
  created_at: string;
  updated_at: string;
}

export interface CreateMentionTagData {
  mention_id: string;
  tenant_id: string;
  category_id: string;
  intent_id: string;
  priority: 'low' | 'medium' | 'high';
  urgency_score: number;
  confidence: number;
  ai_model: string;
  ai_provider?: string;
}