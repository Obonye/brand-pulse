export interface DiscoveredTag {
  id: string;
  tenant_id: string;
  tag_name: string;
  tag_type: 'topic' | 'category' | 'intent';
  frequency_count: number;
  confidence_score: number;
  first_discovered_at: string;
  last_used_at: string;
  is_approved: boolean;
  created_by_ai: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateDiscoveredTagData {
  tenant_id: string;
  tag_name: string;
  tag_type: 'topic' | 'category' | 'intent';
  confidence_score: number;
  frequency_count?: number;
  created_by_ai?: boolean;
}