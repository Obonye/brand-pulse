##scraped_mentions
[
  {
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "uuid_generate_v4()"
  },
  {
    "column_name": "tenant_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "brand_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "job_run_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "source_type",
    "data_type": "USER-DEFINED",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "source_url",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "source_id",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "title",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "content",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "author",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "author_url",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "author_followers",
    "data_type": "integer",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "published_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "scraped_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "column_name": "language",
    "data_type": "character varying",
    "is_nullable": "YES",
    "column_default": "'en'::character varying"
  },
  {
    "column_name": "metadata",
    "data_type": "jsonb",
    "is_nullable": "YES",
    "column_default": "'{}'::jsonb"
  }
]

##brands
[
  {
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "uuid_generate_v4()"
  },
  {
    "column_name": "tenant_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "name",
    "data_type": "character varying",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "description",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "website_url",
    "data_type": "character varying",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "logo_url",
    "data_type": "character varying",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "keywords",
    "data_type": "ARRAY",
    "is_nullable": "YES",
    "column_default": "'{}'::text[]"
  },
  {
    "column_name": "competitor_brands",
    "data_type": "ARRAY",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "location",
    "data_type": "character varying",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "is_active",
    "data_type": "boolean",
    "is_nullable": "YES",
    "column_default": "true"
  },
  {
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "column_name": "industry_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  }
]


##sentiment_analysis

[
  {
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "column_name": "mention_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "tenant_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "sentiment",
    "data_type": "character varying",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "confidence",
    "data_type": "numeric",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "reasoning",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "ai_model",
    "data_type": "character varying",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "ai_provider",
    "data_type": "character varying",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "analysis_version",
    "data_type": "character varying",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": "now()"
  }
]

##mention_tags

[
  {
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "column_name": "mention_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "tenant_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "category_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "intent_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "priority",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "urgency_score",
    "data_type": "numeric",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "confidence",
    "data_type": "numeric",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "ai_model",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "ai_provider",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": "'openai'::text"
  },
  {
    "column_name": "created_at",
    "data_type": "timestamp without time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "column_name": "updated_at",
    "data_type": "timestamp without time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  }
]

##tag_categories

[
  {
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "column_name": "tenant_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "name",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "display_name",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "description",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "color_hex",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": "'#6C757D'::text"
  },
  {
    "column_name": "icon",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "is_active",
    "data_type": "boolean",
    "is_nullable": "YES",
    "column_default": "true"
  },
  {
    "column_name": "sort_order",
    "data_type": "integer",
    "is_nullable": "YES",
    "column_default": "0"
  },
  {
    "column_name": "created_at",
    "data_type": "timestamp without time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "column_name": "updated_at",
    "data_type": "timestamp without time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  }
]

##tag_intents

[
  {
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "column_name": "tenant_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "name",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "display_name",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "description",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "is_active",
    "data_type": "boolean",
    "is_nullable": "YES",
    "column_default": "true"
  },
  {
    "column_name": "created_at",
    "data_type": "timestamp without time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "column_name": "updated_at",
    "data_type": "timestamp without time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  }
]

##mention_topics

[
  {
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "column_name": "mention_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "column_name": "confidence",
    "data_type": "numeric",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "column_name": "created_at",
    "data_type": "timestamp without time zone",
    "is_nullable": "YES",
    "column_default": "now()"
  },
  {
    "column_name": "topic",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  }
]




