# AI Reports RPC Functions - Corrected for Actual Schema

## Main Report Data Function

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
  published_at TIMESTAMP WITH TIME ZONE,
  scraped_at TIMESTAMP WITH TIME ZONE,
  sentiment VARCHAR,
  sentiment_confidence NUMERIC,
  brand_name VARCHAR,
  brand_id UUID,
  source_type TEXT,
  source_url TEXT,
  title TEXT,
  -- AI Tags aggregated as JSON
  tags JSONB,
  -- Topics aggregated as JSON array
  topics JSONB,
  -- Priority and urgency from tags
  max_priority TEXT,
  max_urgency_score NUMERIC,
  -- Metadata
  author_followers INTEGER,
  metadata JSONB
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
    sa.confidence as sentiment_confidence,
    b.name as brand_name,
    b.id as brand_id,
    sm.source_type::TEXT,
    sm.source_url,
    sm.title,
    
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
    sm.author_followers,
    sm.metadata
    
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
    AND (p_source_types IS NULL OR sm.source_type::TEXT = ANY(p_source_types))
    
  GROUP BY 
    sm.id, sm.content, sm.author, sm.published_at, sm.scraped_at,
    sa.sentiment, sa.confidence, b.name, b.id, sm.source_type,
    sm.source_url, sm.title, sm.author_followers, sm.metadata
    
  ORDER BY 
    sm.published_at DESC
    
  LIMIT p_limit_count;
END;
$$;
```

## Summary Stats Function

```sql
-- Create RPC function for summary statistics
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
  avg_sentiment_confidence NUMERIC,
  high_priority_count BIGINT,
  medium_priority_count BIGINT,
  low_priority_count BIGINT,
  avg_urgency_score NUMERIC,
  unique_authors BIGINT,
  top_source_types JSONB,
  top_categories JSONB,
  top_topics JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH base_data AS (
    SELECT 
      sm.id,
      sa.sentiment,
      sa.confidence,
      sm.source_type::TEXT,
      sm.author,
      mt.priority,
      mt.urgency_score,
      tc.display_name as category_name,
      mtop.topic
    FROM scraped_mentions sm
    INNER JOIN brands b ON sm.brand_id = b.id
    LEFT JOIN sentiment_analysis sa ON sm.id = sa.mention_id
    LEFT JOIN mention_tags mt ON sm.id = mt.mention_id
    LEFT JOIN tag_categories tc ON mt.category_id = tc.id
    LEFT JOIN mention_topics mtop ON sm.id = mtop.mention_id
    WHERE 
      sm.tenant_id = p_tenant_id
      AND b.tenant_id = p_tenant_id
      AND (p_start_date IS NULL OR sm.published_at >= p_start_date)
      AND (p_end_date IS NULL OR sm.published_at <= p_end_date)
      AND (p_brand_ids IS NULL OR sm.brand_id = ANY(p_brand_ids))
  ),
  source_type_stats AS (
    SELECT 
      source_type,
      COUNT(*) as count
    FROM base_data
    WHERE source_type IS NOT NULL
    GROUP BY source_type
    ORDER BY count DESC
    LIMIT 10
  ),
  category_stats AS (
    SELECT 
      category_name,
      COUNT(*) as count
    FROM base_data
    WHERE category_name IS NOT NULL
    GROUP BY category_name
    ORDER BY count DESC
    LIMIT 10
  ),
  topic_stats AS (
    SELECT 
      topic,
      COUNT(*) as count
    FROM base_data
    WHERE topic IS NOT NULL
    GROUP BY topic
    ORDER BY count DESC
    LIMIT 10
  )
  SELECT 
    COUNT(DISTINCT bd.id) as total_mentions,
    COUNT(DISTINCT bd.id) FILTER (WHERE bd.sentiment = 'positive') as sentiment_positive,
    COUNT(DISTINCT bd.id) FILTER (WHERE bd.sentiment = 'negative') as sentiment_negative,
    COUNT(DISTINCT bd.id) FILTER (WHERE bd.sentiment = 'neutral') as sentiment_neutral,
    COALESCE(AVG(bd.confidence), 0) as avg_sentiment_confidence,
    
    -- Priority counts from tags
    COUNT(DISTINCT bd.id) FILTER (WHERE bd.priority = 'high') as high_priority_count,
    COUNT(DISTINCT bd.id) FILTER (WHERE bd.priority = 'medium') as medium_priority_count,  
    COUNT(DISTINCT bd.id) FILTER (WHERE bd.priority = 'low') as low_priority_count,
    COALESCE(AVG(bd.urgency_score), 0) as avg_urgency_score,
    
    COUNT(DISTINCT bd.author) as unique_authors,
    
    -- Top source types
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object('source_type', sts.source_type, 'count', sts.count)
        ORDER BY sts.count DESC
      ) FROM source_type_stats sts),
      '[]'::jsonb
    ) as top_source_types,
    
    -- Top categories  
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object('category', cs.category_name, 'count', cs.count)
        ORDER BY cs.count DESC
      ) FROM category_stats cs),
      '[]'::jsonb
    ) as top_categories,
    
    -- Top topics
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object('topic', ts.topic, 'count', ts.count)
        ORDER BY ts.count DESC
      ) FROM topic_stats ts),
      '[]'::jsonb
    ) as top_topics
    
  FROM base_data bd;
END;
$$;
```

## Test Queries

```sql
-- Test the main function
SELECT 
  mention_id,
  content,
  sentiment,
  sentiment_confidence,
  brand_name,
  source_type,
  title,
  jsonb_array_length(tags) as tag_count,
  jsonb_array_length(topics) as topic_count,
  max_priority,
  author_followers
FROM get_mentions_report_data(
  'your-tenant-uuid-here'::UUID,
  (NOW() - INTERVAL '7 days')::TIMESTAMP,
  NOW()::TIMESTAMP,
  NULL::UUID[],
  NULL::TEXT[],
  5::INTEGER,
  0.7::DECIMAL,
  0.6::DECIMAL
);

-- Test the summary stats function
SELECT * FROM get_mentions_summary_stats(
  'your-tenant-uuid-here'::UUID,
  (NOW() - INTERVAL '30 days')::TIMESTAMP,
  NOW()::TIMESTAMP,
  NULL::UUID[]
);
```

## Key Corrections Made

1. **Schema Alignment**:
   - `sentiment_score` → `sentiment_confidence` (using `sa.confidence`)
   - Removed `platform` column (doesn't exist)
   - `follower_count` → `author_followers`
   - `engagement_metrics` → `metadata`
   - Added `title` column
   - Cast `source_type` to TEXT since it's USER-DEFINED type

2. **Data Types**:
   - `DECIMAL` → `NUMERIC` where appropriate
   - Added `WITH TIME ZONE` for timestamps
   - `VARCHAR` for character varying columns

3. **Summary Stats Function**:
   - Rewrote with CTEs for better performance and clarity
   - Changed platform stats to source_type stats
   - Fixed all column references to match actual schema
   - Simplified aggregation logic

Both functions now match your actual database schema and should work correctly!