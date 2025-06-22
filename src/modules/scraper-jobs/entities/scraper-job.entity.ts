export interface ScraperJob {
    id: string;
    tenant_id: string;
    brand_id: string;
    name: string;
    source_type: string;
    config: Record<string, any>;
    schedule_cron: string;
    is_active: boolean;
    last_run_at?: string;
    next_run_at: string;
    created_at: string;
    updated_at: string;
    // Relations
    brands?: {
      id: string;
      name: string;
    };
  }
  
  export interface ScraperRun {
    id: string;
    job_id: string;
    tenant_id: string;
    status: 'scheduled' | 'running' | 'completed' | 'failed';
    apify_run_id?: string;
    started_at?: string;
    finished_at?: string;
    completed_at?: string;
    items_found?: number;
    items_processed?: number;
    items_failed?: number;
    error_message?: string;
    metadata?: Record<string, any>;
    created_at?: string;
    updated_at?: string;
  }
  