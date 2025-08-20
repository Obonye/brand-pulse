# AI Reports RPC Functions

This document contains Supabase RPC (Remote Procedure Call) functions for the AI Reports system. These functions provide efficient server-side data aggregation for report generation.

## Overview

The RPC functions optimize data retrieval by performing aggregations directly in the database, reducing API call overhead and improving performance for report generation.

---

## RPC Function: get_mentions_report_data

This function returns comprehensive aggregated mention data for AI report generation, including sentiment analysis, AI tags, topics, and metadata.

### Function Definition

```sql
-- Create RPC function for AI reports data aggregation
CREATE OR REPLACE FUNCTION get_mentions_report_data(
  p_tenant_id UUID,
  p_start_date TIMESTAMP DEFAULT NULL,
  p_end_date TIMESTAMP DEFAULT NULL,
  p_brand_ids UUID[] DEFAULT NULL,
  p_source_types TEXT[] DEFAULT NULL,
  p_limit_count INTEGER DEFAULT 1000,
  p_min_tag_confidence DECIMAL DEFAULT 0.7,
  p_min_topic_confidence DECIMAL DEFAULT 0.6
)
RETURNS TABLE (
  mention_id UUID,
  content TEXT,
  author TEXT,
  published_at TIMESTAMP,
  scraped_at TIMESTAMP,
  sentiment TEXT,
  confidence DECIMAL,
  brand_name TEXT,
  brand_id UUID,
  source_type TEXT,
  source_url TEXT,
  source_type TEXT,
  -- AI Tags aggregated as JSON
  tags JSONB,
  -- Topics aggregated as JSON array
  topics JSONB,
  -- Priority and urgency from tags
  max_priority TEXT,
  max_urgency_score DECIMAL,
  -- Metadata
  follower_count INTEGER,
  engagement_metrics JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate tenant access (additional security layer)
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant ID is required';
  END IF;

  RETURN QUERY
  SELECT 
    sm.id as mention_id,
    sm.content,
    sm.author,
    sm.published_at,
    sm.scraped_at,
    sa.sentiment,
    sa.confidence,
    b.name as brand_name,
    b.id as brand_id,
    sm.source_type,
    sm.source_url,
    sm.platform,
    
    -- Aggregate AI tags into structured JSON (only high-confidence tags)
    COALESCE(
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'category', tc.name,
          'category_display', tc.display_name,
          'intent', ti.name,
          'intent_display', ti.display_name,
          'priority', mt.priority,
          'urgency_score', mt.urgency_score,
          'ai_model', mt.ai_model
        )
      ) FILTER (WHERE mt.id IS NOT NULL AND mt.confidence >= p_min_tag_confidence),
      '[]'::jsonb
    ) as tags,
    
    -- Aggregate topics into JSON array (only high-confidence topics)
    COALESCE(
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'name', mtop.topic
        )
      ) FILTER (WHERE mtop.id IS NOT NULL AND mtop.confidence >= p_min_topic_confidence),
      '[]'::jsonb
    ) as topics,
    
    -- Get maximum priority and urgency for sorting/filtering (only from high-confidence tags)
    CASE 
      WHEN 'high' = ANY(array_agg(mt.priority) FILTER (WHERE mt.confidence >= p_min_tag_confidence)) THEN 'high'
      WHEN 'medium' = ANY(array_agg(mt.priority) FILTER (WHERE mt.confidence >= p_min_tag_confidence)) THEN 'medium'
      ELSE 'low'
    END as max_priority,
    
    COALESCE(MAX(mt.urgency_score) FILTER (WHERE mt.confidence >= p_min_tag_confidence), 0) as max_urgency_score,
    
    -- Additional metadata
    sm.follower_count,
    sm.engagement_metrics
    
  FROM scraped_mentions sm
  INNER JOIN brands b ON sm.brand_id = b.id
  LEFT JOIN sentiment_analysis sa ON sm.id = sa.mention_id
  LEFT JOIN mention_tags mt ON sm.id = mt.mention_id
  LEFT JOIN tag_categories tc ON mt.category_id = tc.id
  LEFT JOIN tag_intents ti ON mt.intent_id = ti.id  
  LEFT JOIN mention_topics mtop ON sm.id = mtop.mention_id
  
  WHERE 
    sm.tenant_id = p_tenant_id
    AND b.tenant_id = p_tenant_id
    AND (p_start_date IS NULL OR sm.published_at >= p_start_date)
    AND (p_end_date IS NULL OR sm.published_at <= p_end_date)
    AND (p_brand_ids IS NULL OR sm.brand_id = ANY(p_brand_ids))
    AND (p_source_types IS NULL OR sm.source_type = ANY(p_source_types))
    
  GROUP BY 
    sm.id, sm.content, sm.author, sm.published_at, sm.scraped_at,
    sa.sentiment, sa.confidence, b.name, b.id, sm.source_type,
    sm.source_url, sm.platform, sm.follower_count, sm.engagement_metrics
    
  ORDER BY 
    sm.published_at DESC
    
  LIMIT p_limit_count;
END;
$$;
```

### Function Usage Examples

#### Basic Usage
```sql
-- Get all mentions for a tenant in the last 7 days
SELECT * FROM get_mentions_report_data(
  '123e4567-e89b-12d3-a456-426614174000'::UUID,  -- tenant_id
  NOW() - INTERVAL '7 days',                      -- start_date
  NOW(),                                          -- end_date
  NULL,                                           -- brand_ids (all brands)
  NULL,                                           -- source_types (all sources)
  1000,                                           -- limit
  0.7,                                            -- min_tag_confidence
  0.6                                             -- min_topic_confidence
);
```

#### Filtered by Brand
```sql
-- Get mentions for specific brands
SELECT * FROM get_mentions_report_data(
  '123e4567-e89b-12d3-a456-426614174000'::UUID,  -- tenant_id
  NOW() - INTERVAL '30 days',                     -- start_date
  NOW(),                                          -- end_date
  ARRAY['brand-uuid-1', 'brand-uuid-2']::UUID[]  -- brand_ids
);
```

#### Filtered by Source Types
```sql
-- Get mentions from specific platforms
SELECT * FROM get_mentions_report_data(
  '123e4567-e89b-12d3-a456-426614174000'::UUID,  -- tenant_id
  NOW() - INTERVAL '7 days',                      -- start_date
  NOW(),                                          -- end_date
  NULL,                                           -- brand_ids (all brands)
  ARRAY['twitter', 'facebook', 'instagram']      -- source_types
);
```

#### High Priority Mentions Only
```sql
-- Get high priority mentions for crisis management
SELECT * FROM get_mentions_report_data(
  '123e4567-e89b-12d3-a456-426614174000'::UUID,
  NOW() - INTERVAL '24 hours',
  NOW()
) WHERE max_priority = 'high';
```

---

## Additional Helper RPC Functions

### Function: get_mentions_summary_stats

Returns aggregated statistics for dashboard widgets and report summaries.

```sql
CREATE OR REPLACE FUNCTION get_mentions_summary_stats(
  p_tenant_id UUID,
  p_start_date TIMESTAMP DEFAULT NULL,
  p_end_date TIMESTAMP DEFAULT NULL,
  p_brand_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  total_mentions BIGINT,
  sentiment_positive BIGINT,
  sentiment_negative BIGINT,
  sentiment_neutral BIGINT,
  avg_sentiment_score DECIMAL,
  high_priority_count BIGINT,
  medium_priority_count BIGINT,
  low_priority_count BIGINT,
  avg_urgency_score DECIMAL,
  unique_authors BIGINT,
  top_platforms JSONB,
  top_categories JSONB,
  top_topics JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT sm.id) as total_mentions,
    COUNT(DISTINCT sm.id) FILTER (WHERE sa.sentiment = 'positive') as sentiment_positive,
    COUNT(DISTINCT sm.id) FILTER (WHERE sa.sentiment = 'negative') as sentiment_negative,
    COUNT(DISTINCT sm.id) FILTER (WHERE sa.sentiment = 'neutral') as sentiment_neutral,
    COALESCE(AVG(sa.sentiment_score), 0) as avg_sentiment_score,
    
    -- Priority counts from tags
    COUNT(DISTINCT sm.id) FILTER (WHERE mt.priority = 'high') as high_priority_count,
    COUNT(DISTINCT sm.id) FILTER (WHERE mt.priority = 'medium') as medium_priority_count,  
    COUNT(DISTINCT sm.id) FILTER (WHERE mt.priority = 'low') as low_priority_count,
    COALESCE(AVG(mt.urgency_score), 0) as avg_urgency_score,
    
    COUNT(DISTINCT sm.author) as unique_authors,
    
    -- Top platforms
    jsonb_agg(
      jsonb_build_object('platform', platform_stats.platform, 'count', platform_stats.count)
      ORDER BY platform_stats.count DESC
    ) FILTER (WHERE platform_stats.platform IS NOT NULL) as top_platforms,
    
    -- Top categories  
    jsonb_agg(
      jsonb_build_object('category', category_stats.category, 'count', category_stats.count)
      ORDER BY category_stats.count DESC
    ) FILTER (WHERE category_stats.category IS NOT NULL) as top_categories,
    
    -- Top topics
    jsonb_agg(
      jsonb_build_object('topic', topic_stats.topic, 'count', topic_stats.count)
      ORDER BY topic_stats.count DESC  
    ) FILTER (WHERE topic_stats.topic IS NOT NULL) as top_topics
    
  FROM scraped_mentions sm
  INNER JOIN brands b ON sm.brand_id = b.id
  LEFT JOIN sentiment_analysis sa ON sm.id = sa.mention_id
  LEFT JOIN mention_tags mt ON sm.id = mt.mention_id
  LEFT JOIN tag_categories tc ON mt.category_id = tc.id
  LEFT JOIN mention_topics mtop ON sm.id = mtop.mention_id
  
  -- Subqueries for aggregated stats
  LEFT JOIN LATERAL (
    SELECT platform, COUNT(*) as count
    FROM scraped_mentions sm2
    WHERE sm2.tenant_id = p_tenant_id
    AND (p_start_date IS NULL OR sm2.published_at >= p_start_date)
    AND (p_end_date IS NULL OR sm2.published_at <= p_end_date)
    AND (p_brand_ids IS NULL OR sm2.brand_id = ANY(p_brand_ids))
    GROUP BY platform
    ORDER BY count DESC
    LIMIT 10
  ) platform_stats ON true
  
  LEFT JOIN LATERAL (
    SELECT tc2.display_name as category, COUNT(*) as count
    FROM mention_tags mt2
    INNER JOIN tag_categories tc2 ON mt2.category_id = tc2.id
    INNER JOIN scraped_mentions sm3 ON mt2.mention_id = sm3.id
    WHERE mt2.tenant_id = p_tenant_id
    AND (p_start_date IS NULL OR sm3.published_at >= p_start_date)
    AND (p_end_date IS NULL OR sm3.published_at <= p_end_date)
    AND (p_brand_ids IS NULL OR sm3.brand_id = ANY(p_brand_ids))
    GROUP BY tc2.display_name
    ORDER BY count DESC
    LIMIT 10
  ) category_stats ON true
  
  LEFT JOIN LATERAL (
    SELECT mtop2.topic, COUNT(*) as count
    FROM mention_topics mtop2
    INNER JOIN scraped_mentions sm4 ON mtop2.mention_id = sm4.id
    WHERE sm4.tenant_id = p_tenant_id
    AND (p_start_date IS NULL OR sm4.published_at >= p_start_date)
    AND (p_end_date IS NULL OR sm4.published_at <= p_end_date)
    AND (p_brand_ids IS NULL OR sm4.brand_id = ANY(p_brand_ids))
    GROUP BY mtop2.topic
    ORDER BY count DESC
    LIMIT 10
  ) topic_stats ON true
  
  WHERE 
    sm.tenant_id = p_tenant_id
    AND b.tenant_id = p_tenant_id
    AND (p_start_date IS NULL OR sm.published_at >= p_start_date)
    AND (p_end_date IS NULL OR sm.published_at <= p_end_date)
    AND (p_brand_ids IS NULL OR sm.brand_id = ANY(p_brand_ids));
END;
$$;
```

---

## Performance Indexes

Add these indexes to optimize RPC function performance:

```sql
-- Composite indexes for report queries
CREATE INDEX IF NOT EXISTS idx_scraped_mentions_tenant_published_sentiment 
ON scraped_mentions(tenant_id, published_at DESC, sentiment);

CREATE INDEX IF NOT EXISTS idx_scraped_mentions_tenant_brand_published 
ON scraped_mentions(tenant_id, brand_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_mention_tags_mention_priority_urgency 
ON mention_tags(mention_id, priority, urgency_score DESC);

CREATE INDEX IF NOT EXISTS idx_mention_topics_mention_confidence 
ON mention_topics(mention_id, confidence DESC);

-- Platform and source type filtering
CREATE INDEX IF NOT EXISTS idx_scraped_mentions_tenant_platform_published 
ON scraped_mentions(tenant_id, platform, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_scraped_mentions_tenant_source_published 
ON scraped_mentions(tenant_id, source_type, published_at DESC);
```

---

## Usage in AI Reports Service

### TypeScript Integration Example

```typescript
// In your AI Reports Service
export class ReportDataService {
  constructor(private supabaseService: SupabaseService) {}

  async getMentionsForReport(
    tenantId: string,
    options: {
      startDate?: string;
      endDate?: string;
      brandIds?: string[];
      sourceTypes?: string[];
      limit?: number;
      minTagConfidence?: number;
      minTopicConfidence?: number;
    }
  ) {
    const { data, error } = await this.supabaseService.adminClient
      .rpc('get_mentions_report_data', {
        p_tenant_id: tenantId,
        p_start_date: options.startDate,
        p_end_date: options.endDate,
        p_brand_ids: options.brandIds,
        p_source_types: options.sourceTypes,
        p_limit_count: options.limit || 1000,
        p_min_tag_confidence: options.minTagConfidence || 0.7,
        p_min_topic_confidence: options.minTopicConfidence || 0.6
      });

    if (error) {
      throw new Error(`Failed to fetch report data: ${error.message}`);
    }

    return data;
  }

  async getReportSummaryStats(tenantId: string, options: any) {
    const { data, error } = await this.supabaseService.adminClient
      .rpc('get_mentions_summary_stats', {
        p_tenant_id: tenantId,
        p_start_date: options.startDate,
        p_end_date: options.endDate,
        p_brand_ids: options.brandIds
      });

    if (error) {
      throw new Error(`Failed to fetch summary stats: ${error.message}`);
    }

    return data[0]; // Returns single row with aggregated stats
  }
}
```

---

## Benefits of RPC Functions

1. **Performance**: Server-side aggregation reduces data transfer and client-side processing
2. **Security**: Functions run with elevated privileges while maintaining tenant isolation
3. **Consistency**: Centralized data logic ensures consistent results across all reports
4. **Scalability**: Database-level optimizations handle large datasets efficiently
5. **Maintainability**: Single source of truth for report data aggregation logic

---

## Notes

- Functions use `SECURITY DEFINER` to run with elevated database privileges
- Tenant isolation is enforced at the function level for additional security
- JSON aggregation provides flexible data structure for AI prompt generation
- Functions are optimized for the AI reports use case but flexible enough for other analytics needs
- Consider adding additional indexes based on actual query patterns and performance monitoring