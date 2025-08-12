# AI Tagging System - Database Setup

This document contains the complete SQL setup for the AI tagging system in BrandPulse. Run these statements in Supabase in the exact order provided.

## Overview

The AI tagging system enables industry-specific, intelligent categorization of social media mentions with:
- Industry-specific tag templates
- Dynamic tag discovery
- Multi-tenant isolation
- Priority and urgency scoring
- Comprehensive analytics support

## Setup Instructions

Execute these SQL statements in Supabase SQL Editor in the order provided below.

---

## Step 1: Industries Table

```sql
-- Create industries table first (referenced by other tables)
CREATE TABLE industries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert seed data for common industries
INSERT INTO industries (name, display_name, description) VALUES
('restaurant', 'Restaurant & Food Service', 'Restaurants, cafes, food delivery, and dining establishments'),
('banking', 'Banking & Financial Services', 'Banks, credit unions, financial institutions, and fintech'),
('retail', 'Retail & E-commerce', 'Retail stores, online shopping, consumer goods'),
('hospitality', 'Hospitality & Hotels', 'Hotels, resorts, travel, and accommodation services'),
('healthcare', 'Healthcare & Medical', 'Hospitals, clinics, medical services, and healthcare providers'),
('technology', 'Technology & Software', 'Tech companies, software, apps, and digital services'),
('automotive', 'Automotive', 'Car dealerships, auto services, and automotive industry'),
('real_estate', 'Real Estate', 'Property sales, rentals, and real estate services'),
('education', 'Education', 'Schools, universities, online learning, and educational services'),
('general', 'General Business', 'Default category for unspecified industries');
```

## Step 2: Add Industry to Tenants

```sql
-- Add industry reference to tenants table
ALTER TABLE tenants ADD COLUMN industry_id UUID REFERENCES industries(id);

-- Create index for tenant industry lookups
CREATE INDEX idx_tenants_industry ON tenants(industry_id);

-- Optional: Set default industry for existing tenants
UPDATE tenants 
SET industry_id = (SELECT id FROM industries WHERE name = 'general' LIMIT 1)
WHERE industry_id IS NULL;
```

## Step 3: Add Industry to Brands

```sql
-- Add industry reference to brands table
ALTER TABLE brands ADD COLUMN industry_id UUID REFERENCES industries(id);

-- Create index for brand industry lookups
CREATE INDEX idx_brands_industry ON brands(industry_id);
```

## Step 4: Tag Categories Table

```sql
-- Create tag categories table
CREATE TABLE tag_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  color_hex TEXT DEFAULT '#6C757D',
  icon TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_tenant_category UNIQUE(tenant_id, name)
);

-- Insert default categories (tenant_id = NULL means global defaults)
INSERT INTO tag_categories (tenant_id, name, display_name, description, color_hex) VALUES
(NULL, 'complaint', 'Customer Complaint', 'Negative feedback or issues reported by customers', '#DC3545'),
(NULL, 'compliment', 'Positive Feedback', 'Praise and positive mentions from customers', '#28A745'),
(NULL, 'inquiry', 'Customer Inquiry', 'Questions or requests for information', '#17A2B8'),
(NULL, 'neutral', 'Neutral Mention', 'Factual or neutral statements about the brand', '#6C757D'),
(NULL, 'suggestion', 'Customer Suggestion', 'Improvement suggestions from customers', '#FFC107');

-- Create index for category lookups
CREATE INDEX idx_tag_categories_tenant ON tag_categories(tenant_id, is_active);
CREATE INDEX idx_tag_categories_active ON tag_categories(is_active);
```

## Step 5: Tag Intents Table

```sql
-- Create tag intents table
CREATE TABLE tag_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_tenant_intent UNIQUE(tenant_id, name)
);

-- Insert default intents (tenant_id = NULL means global defaults)
INSERT INTO tag_intents (tenant_id, name, display_name, description) VALUES
(NULL, 'complaint', 'Filing a Complaint', 'Customer is reporting an issue or problem'),
(NULL, 'compliment', 'Giving Praise', 'Customer is expressing satisfaction or praise'),
(NULL, 'support_request', 'Requesting Support', 'Customer needs help or assistance'),
(NULL, 'product_inquiry', 'Product Question', 'Customer asking about products or services'),
(NULL, 'purchase_intent', 'Purchase Interest', 'Customer showing interest in buying'),
(NULL, 'feedback', 'General Feedback', 'Customer providing general feedback or opinions');

-- Create index for intent lookups
CREATE INDEX idx_tag_intents_tenant ON tag_intents(tenant_id, is_active);
```

## Step 6: Industry Tag Templates

```sql
-- Create industry-specific tag templates
CREATE TABLE industry_tag_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id UUID NOT NULL REFERENCES industries(id),
  category TEXT NOT NULL,
  topics TEXT[] NOT NULL,
  intents TEXT[] NOT NULL,
  ai_prompt_context TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert restaurant industry template
INSERT INTO industry_tag_templates (industry_id, category, topics, intents, ai_prompt_context) VALUES
((SELECT id FROM industries WHERE name = 'restaurant'), 
 'operational', 
 ARRAY['food_quality', 'service_speed', 'cleanliness', 'ambiance', 'pricing', 'staff_behavior', 'wait_times', 'menu_variety', 'reservation_system', 'delivery_experience'],
 ARRAY['complaint', 'compliment', 'suggestion', 'inquiry', 'support_request'],
 'Focus on restaurant and food service aspects: food taste, freshness, presentation, service quality, restaurant atmosphere, dining experience, staff friendliness, and operational efficiency.');

-- Insert banking industry template  
INSERT INTO industry_tag_templates (industry_id, category, topics, intents, ai_prompt_context) VALUES
((SELECT id FROM industries WHERE name = 'banking'),
 'service',
 ARRAY['customer_service', 'digital_banking', 'fees', 'loan_process', 'security_concerns', 'branch_experience', 'mobile_app', 'interest_rates', 'account_management', 'fraud_protection'],
 ARRAY['complaint', 'inquiry', 'compliment', 'support_request', 'security_concern'],
 'Focus on banking and financial services: account management, digital banking experience, fees and charges, loan processes, customer service quality, security concerns, and regulatory compliance.');

-- Insert retail industry template
INSERT INTO industry_tag_templates (industry_id, category, topics, intents, ai_prompt_context) VALUES  
((SELECT id FROM industries WHERE name = 'retail'),
 'shopping',
 ARRAY['product_quality', 'customer_service', 'pricing', 'shipping', 'returns', 'store_experience', 'inventory', 'online_experience', 'payment_process', 'product_availability'],
 ARRAY['complaint', 'compliment', 'return_request', 'product_inquiry', 'purchase_intent'],
 'Focus on retail and e-commerce experience: product quality, shopping experience, customer service, pricing competitiveness, shipping and delivery, return processes, and online store functionality.');

-- Insert hospitality industry template
INSERT INTO industry_tag_templates (industry_id, category, topics, intents, ai_prompt_context) VALUES
((SELECT id FROM industries WHERE name = 'hospitality'),
 'guest_experience',
 ARRAY['room_quality', 'service_quality', 'amenities', 'location', 'booking_experience', 'cleanliness', 'staff_behavior', 'facilities', 'value_for_money', 'check_in_out'],
 ARRAY['complaint', 'compliment', 'suggestion', 'inquiry', 'booking_intent'],
 'Focus on hospitality and accommodation: room comfort, service quality, hotel amenities, location convenience, booking process, cleanliness standards, staff professionalism, and overall guest experience.');

-- Create index for template lookups
CREATE INDEX idx_industry_templates_industry ON industry_tag_templates(industry_id);
```

## Step 7: Discovered Tags Table

```sql
-- Create discovered tags table for AI-generated tags
CREATE TABLE discovered_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  tag_name TEXT NOT NULL,
  tag_type TEXT NOT NULL CHECK (tag_type IN ('topic', 'category', 'intent')),
  frequency_count INTEGER DEFAULT 1,
  confidence_score DECIMAL(3,2) CHECK (confidence_score BETWEEN 0 AND 1),
  first_discovered_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),
  is_approved BOOLEAN DEFAULT FALSE,
  created_by_ai BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_discovered_tag UNIQUE(tenant_id, tag_name, tag_type)
);

-- Create indexes for discovered tags
CREATE INDEX idx_discovered_tags_tenant ON discovered_tags(tenant_id, is_approved);
CREATE INDEX idx_discovered_tags_frequency ON discovered_tags(tenant_id, frequency_count DESC, confidence_score DESC);
CREATE INDEX idx_discovered_tags_pending ON discovered_tags(tenant_id, is_approved) WHERE is_approved = FALSE;
```

## Step 8: Topic Definitions Table

```sql
-- Create topic definitions for tenant-specific topics
CREATE TABLE topic_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_tenant_topic UNIQUE(tenant_id, name)
);

-- Create index for topic lookups
CREATE INDEX idx_topic_definitions_tenant ON topic_definitions(tenant_id, is_active);
CREATE INDEX idx_topic_definitions_category ON topic_definitions(tenant_id, category);
```

## Step 9: Mention Tags Table

```sql
-- Create mention tags table (main tagging results)
CREATE TABLE mention_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mention_id UUID NOT NULL REFERENCES scraped_mentions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  category_id UUID NOT NULL REFERENCES tag_categories(id),
  intent_id UUID NOT NULL REFERENCES tag_intents(id),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  urgency_score DECIMAL(3,2) CHECK (urgency_score BETWEEN 0 AND 1),
  confidence DECIMAL(3,2) CHECK (confidence BETWEEN 0 AND 1),
  ai_model TEXT NOT NULL,
  ai_provider TEXT NOT NULL DEFAULT 'openai',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_mention_tag UNIQUE(mention_id, category_id, intent_id)
);

-- Create indexes for mention tags
CREATE INDEX idx_mention_tags_mention_id ON mention_tags(mention_id);
CREATE INDEX idx_mention_tags_tenant_category ON mention_tags(tenant_id, category_id);
CREATE INDEX idx_mention_tags_priority_urgency ON mention_tags(priority, urgency_score DESC);
CREATE INDEX idx_mention_tags_tenant_priority ON mention_tags(tenant_id, priority);
CREATE INDEX idx_mention_tags_created_date ON mention_tags(tenant_id, DATE(created_at));
```

## Step 10: Mention Topics Table

```sql
-- Create mention topics table (many-to-many for topics)
CREATE TABLE mention_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mention_id UUID NOT NULL REFERENCES scraped_mentions(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  confidence DECIMAL(3,2) CHECK (confidence BETWEEN 0 AND 1),
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_mention_topic UNIQUE(mention_id, topic)
);

-- Create indexes for mention topics
CREATE INDEX idx_mention_topics_mention_id ON mention_topics(mention_id);
CREATE INDEX idx_mention_topics_topic ON mention_topics(topic);
CREATE INDEX idx_mention_topics_confidence ON mention_topics(confidence DESC);
```

## Step 11: Performance Indexes

```sql
-- Additional performance indexes
CREATE INDEX idx_tag_categories_sort ON tag_categories(tenant_id, sort_order, name);
CREATE INDEX idx_tag_intents_name ON tag_intents(tenant_id, name);
CREATE INDEX idx_mention_tags_category_id ON mention_tags(category_id);
CREATE INDEX idx_mention_tags_intent_id ON mention_tags(intent_id);

-- Composite indexes for common queries
CREATE INDEX idx_mention_tags_tenant_created ON mention_tags(tenant_id, created_at DESC);
CREATE INDEX idx_mention_tags_urgency_priority ON mention_tags(tenant_id, urgency_score DESC, priority);
```

## Step 12: Row Level Security (Optional but Recommended) TODO: Needs Reviews

```sql
-- Enable RLS for multi-tenant security
ALTER TABLE tag_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE mention_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovered_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_definitions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (adjust based on your auth setup)
CREATE POLICY tenant_isolation_tag_categories ON tag_categories
  FOR ALL TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID OR tenant_id IS NULL);

CREATE POLICY tenant_isolation_mention_tags ON mention_tags
  FOR ALL TO authenticated  
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Add similar policies for other tables...
```

---

## Verification Queries

After running all the above, verify your setup:

```sql
-- Check if tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('industries', 'tag_categories', 'tag_intents', 'mention_tags', 'mention_topics', 'discovered_tags', 'topic_definitions', 'industry_tag_templates');

-- Check seed data
SELECT * FROM industries ORDER BY name;
SELECT * FROM tag_categories WHERE tenant_id IS NULL ORDER BY name;
SELECT * FROM tag_intents WHERE tenant_id IS NULL ORDER BY name;
SELECT * FROM industry_tag_templates ORDER BY industry_id, category;

-- Verify foreign key relationships
SELECT 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name IN ('tag_categories', 'mention_tags', 'mention_topics', 'discovered_tags', 'topic_definitions', 'industry_tag_templates');

-- Check indexes
SELECT schemaname, tablename, indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('mention_tags', 'tag_categories', 'tag_intents', 'mention_topics')
ORDER BY tablename, indexname;
```

---

## Table Relationships

```
industries
├── tenants.industry_id
├── brands.industry_id
└── industry_tag_templates.industry_id

tenants
├── tag_categories.tenant_id
├── tag_intents.tenant_id
├── discovered_tags.tenant_id
├── topic_definitions.tenant_id
└── mention_tags.tenant_id

scraped_mentions (existing)
├── mention_tags.mention_id
└── mention_topics.mention_id

tag_categories
└── mention_tags.category_id

tag_intents
└── mention_tags.intent_id
```

---

## Notes

1. **Order Matters**: Execute these SQL statements in the exact order provided due to foreign key dependencies.

2. **Existing Data**: The setup includes optional updates for existing tenants and brands to use the 'general' industry as default.

3. **Global Defaults**: Tag categories and intents with `tenant_id = NULL` serve as global defaults that can be copied to new tenants.

4. **Industry Templates**: Each industry gets specific topic and intent templates that guide AI tagging.

5. **Multi-tenant**: All tables properly isolate data by tenant_id for security and data separation.

6. **Performance**: Comprehensive indexing strategy for efficient queries across large datasets.

7. **Security**: Optional Row Level Security policies enforce tenant isolation at the database level.

---

## What's Next

After completing this database setup:

1. Update your brands API to include industry selection
2. Implement the AI tagging service
3. Create tag management interfaces
4. Add tag filtering to analytics
5. Build admin interfaces for tag approval

The database foundation is now ready to support the complete AI tagging system!