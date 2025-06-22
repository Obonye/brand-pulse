export interface ScrapedMention {
  id: string;
  tenant_id: string;
  brand_id: string;
  job_run_id: string;
  source_type: string;
  source_url?: string;
  source_id?: string;
  title?: string;
  content: string;
  author?: string;
  author_url?: string;
  author_followers?: number;
  published_at?: string;
  scraped_at?: string;
  language?: string;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  // Relations
  brands?: {
    id: string;
    name: string;
  };
  scraper_runs?: {
    id: string;
    job_id: string;
  };
}