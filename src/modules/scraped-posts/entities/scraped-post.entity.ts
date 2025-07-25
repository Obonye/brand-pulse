export interface ScrapedPost {
  id: string;
  tenant_id: string;
  brand_id: string;
  brand_name?: string;
  source_type: string;
  source_post_id?: string;
  post_url?: string;
  caption?: string;
  post_type?: string;
  hashtags?: string[];
  mentioned_users?: string[];
  likes_count?: number;
  comments_count?: number;
  views_count?: number;
  shares_count?: number;
  author_username?: string;
  author_follower_count?: number;
  display_url?: string;
  image_urls?: string[];
  metadata?: any;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateScrapedPostData {
  tenant_id: string;
  brand_id: string;
  source_type: string;
  source_post_id?: string;
  post_url?: string;
  caption?: string;
  post_type?: string;
  hashtags?: string[];
  mentioned_users?: string[];
  likes_count?: number;
  comments_count?: number;
  views_count?: number;
  shares_count?: number;
  author_username?: string;
  author_follower_count?: number;
  display_url?: string; // Main display image URL
  image_urls?: string[]; // Array of all image URLs
  metadata?: any;
  published_at?: string;
}