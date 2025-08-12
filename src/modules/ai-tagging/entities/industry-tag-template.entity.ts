export interface IndustryTagTemplate {
  id: string;
  industry_id: string;
  category: string;
  topics: string[];
  intents: string[];
  ai_prompt_context?: string;
  created_at: string;
  updated_at: string;
}