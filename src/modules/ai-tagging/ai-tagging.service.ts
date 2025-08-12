import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../shared/supabase/supabase.service';
import { OpenAIService } from '../shared/openai/openai.service';
import { IndustryTagTemplatesService } from './industry-templates/industry-tag-templates.service';
import { LoggerService } from '../../common/logger/logger.service';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

import { MentionTag, CreateMentionTagData } from './entities/mention-tag.entity';
import { MentionTopic, CreateMentionTopicData } from './entities/mention-topic.entity';
import { TagCategory } from './entities/tag-category.entity';
import { TagIntent } from './entities/tag-intent.entity';
import { DiscoveredTag, CreateDiscoveredTagData } from './entities/discovered-tag.entity';
import { TagFilterDto } from './dto/tag-filter.dto';

export interface AITaggingResult {
  mention_id: string;
  category: string;
  intent: string;
  topics: Array<{ name: string; confidence: number }>;
  priority: 'low' | 'medium' | 'high';
  urgency_score: number;
  confidence: number;
  reasoning?: string;
}

@Injectable()
export class AITaggingService {
  private logger: ReturnType<LoggerService['setContext']>;
  private openai: OpenAI;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly openaiService: OpenAIService,
    private readonly industryTemplatesService: IndustryTagTemplatesService,
    private readonly loggerService: LoggerService,
    private readonly configService: ConfigService,
  ) {
    this.logger = this.loggerService.setContext('AITaggingService');
    
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async tagMention(
    mentionId: string, 
    tenantId: string, 
    industryId?: string
  ): Promise<AITaggingResult> {
    if (!this.openai) {
      throw new BadRequestException('OpenAI client not initialized. Please check OPENAI_API_KEY.');
    }

    try {
      // Get mention details
      const mention = await this.getMentionDetails(mentionId, tenantId);
      if (!mention) {
        throw new BadRequestException(`Mention not found: ${mentionId}`);
      }

      // Get industry context
      const brandIndustryId = industryId || mention.brand?.industry_id;
      const industryContext = brandIndustryId 
        ? await this.industryTemplatesService.getPromptContextForIndustry(brandIndustryId)
        : this.getDefaultPromptContext();

      // Get available categories and intents for tenant
      const [categories, intents] = await Promise.all([
        this.getTagCategories(tenantId),
        this.getTagIntents(tenantId)
      ]);

      // Build AI prompt for tagging
      const prompt = this.buildTaggingPrompt(mention, industryContext, categories, intents);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing social media mentions and applying structured tags based on industry-specific contexts. Always respond in valid JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 500,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from OpenAI');
      }

      const taggingResult = this.parseTaggingResponse(result, mentionId);
      
      this.logger.info('Mention tagged successfully by AI', {
        tenantId,
        mentionId,
        category: taggingResult.category,
        intent: taggingResult.intent,
        topicsCount: taggingResult.topics.length,
        priority: taggingResult.priority,
        confidence: taggingResult.confidence
      });

      return taggingResult;
    } catch (error) {
      this.logger.error(`AI tagging failed for mention: ${error.message}`, { mentionId, tenantId });
      throw error;
    }
  }

  async storeMentionTag(taggingResult: AITaggingResult, tenantId: string): Promise<MentionTag> {
    try {
      // Find category and intent IDs
      const [categoryId, intentId] = await Promise.all([
        this.findOrCreateCategory(taggingResult.category, tenantId),
        this.findOrCreateIntent(taggingResult.intent, tenantId)
      ]);

      // Create mention tag
      const mentionTagData: CreateMentionTagData = {
        mention_id: taggingResult.mention_id,
        tenant_id: tenantId,
        category_id: categoryId,
        intent_id: intentId,
        priority: taggingResult.priority,
        urgency_score: taggingResult.urgency_score,
        confidence: taggingResult.confidence,
        ai_model: 'gpt-4',
        ai_provider: 'openai'
      };

      const { data: mentionTag, error: tagError } = await this.supabaseService.adminClient
        .from('mention_tags')
        .upsert(mentionTagData, {
          onConflict: 'mention_id,category_id,intent_id'
        })
        .select()
        .single();

      if (tagError) {
        throw new Error(`Failed to store mention tag: ${tagError.message}`);
      }

      // Store topics
      if (taggingResult.topics.length > 0) {
        const topicData: CreateMentionTopicData[] = taggingResult.topics.map(topic => ({
          mention_id: taggingResult.mention_id,
          topic: topic.name,
          confidence: topic.confidence
        }));

        const { error: topicsError } = await this.supabaseService.adminClient
          .from('mention_topics')
          .upsert(topicData, {
            onConflict: 'mention_id,topic'
          });

        if (topicsError) {
          this.logger.warn(`Failed to store mention topics: ${topicsError.message}`, {
            mentionId: taggingResult.mention_id
          });
        }
      }

      this.logger.info('Mention tag stored successfully', {
        mentionId: taggingResult.mention_id,
        tenantId,
        tagId: mentionTag.id
      });

      return mentionTag;
    } catch (error) {
      this.logger.error(`Failed to store mention tag: ${error.message}`, {
        mentionId: taggingResult.mention_id,
        tenantId
      });
      throw error;
    }
  }

  async bulkTagMentions(
    mentionIds: string[], 
    tenantId: string, 
    industryId?: string,
    forceRetag: boolean = false
  ): Promise<{ success: number; failed: number; results: AITaggingResult[] }> {
    const results: AITaggingResult[] = [];
    let successCount = 0;
    let failedCount = 0;

    this.logger.info('Starting bulk AI tagging', {
      tenantId,
      mentionCount: mentionIds.length,
      industryId,
      forceRetag
    });

    for (const mentionId of mentionIds) {
      try {
        // Check if already tagged (unless forcing retag)
        if (!forceRetag) {
          const existingTag = await this.getMentionTag(mentionId, tenantId);
          if (existingTag) {
            this.logger.debug('Mention already tagged, skipping', { mentionId, tenantId });
            continue;
          }
        }

        const taggingResult = await this.tagMention(mentionId, tenantId, industryId);
        await this.storeMentionTag(taggingResult, tenantId);
        
        results.push(taggingResult);
        successCount++;

        // Rate limiting
        await this.delay(500);
      } catch (error) {
        this.logger.error(`Bulk tagging failed for mention: ${error.message}`, { mentionId, tenantId });
        failedCount++;
      }
    }

    this.logger.info('Bulk AI tagging completed', {
      tenantId,
      totalProcessed: mentionIds.length,
      successful: successCount,
      failed: failedCount,
      successRate: mentionIds.length > 0 ? Math.round((successCount / mentionIds.length) * 100) : 0
    });

    return {
      success: successCount,
      failed: failedCount,
      results
    };
  }

  private async getMentionDetails(mentionId: string, tenantId: string) {
    const { data, error } = await this.supabaseService.adminClient
      .from('scraped_mentions')
      .select(`
        *,
        brands(id, name, industry_id, industries(id, name, display_name))
      `)
      .eq('id', mentionId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      this.logger.error(`Failed to fetch mention details: ${error.message}`, { mentionId, tenantId });
      return null;
    }

    return data;
  }

  private async getTagCategories(tenantId: string): Promise<TagCategory[]> {
    const { data, error } = await this.supabaseService.adminClient
      .from('tag_categories')
      .select('*')
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .eq('is_active', true)
      .order('sort_order');

    return data || [];
  }

  private async getTagIntents(tenantId: string): Promise<TagIntent[]> {
    const { data, error } = await this.supabaseService.adminClient
      .from('tag_intents')
      .select('*')
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .eq('is_active', true)
      .order('name');

    return data || [];
  }

  private buildTaggingPrompt(mention: any, industryContext: string, categories: TagCategory[], intents: TagIntent[]): string {
    const availableCategories = categories.map(c => `${c.name}: ${c.description || c.display_name}`).join('\n');
    const availableIntents = intents.map(i => `${i.name}: ${i.description || i.display_name}`).join('\n');

    return `Analyze this social media mention and provide structured tagging based on the industry context.

MENTION TO ANALYZE:
"${mention.content || mention.title}"

CONTEXT:
- Source: ${mention.source_type}
- Brand: ${mention.brands?.name || 'Unknown'}
- Author: ${mention.author || 'Unknown'}
- Author Followers: ${mention.author_followers || 0}
- Published: ${mention.published_at || mention.scraped_at}
- Language: ${mention.language || 'en'}
- Source URL: ${mention.source_url || 'N/A'}

INDUSTRY CONTEXT:
${industryContext}

AVAILABLE CATEGORIES:
${availableCategories}

AVAILABLE INTENTS:
${availableIntents}

Respond in JSON format with:
{
  "category": "category_name_from_list",
  "intent": "intent_name_from_list", 
  "topics": [{"name": "topic1", "confidence": 0.9}, {"name": "topic2", "confidence": 0.7}],
  "priority": "low|medium|high",
  "urgency_score": 0.85,
  "confidence": 0.92,
  "reasoning": "Brief explanation of the tagging decision"
}

Rules:
- Use only category and intent names from the provided lists
- Topics should be specific aspects mentioned in the text
- Priority: high for complaints/urgent issues, medium for feedback, low for general mentions
- Urgency score: 0-1 scale based on need for immediate response
- Confidence: 0-1 scale for overall tagging confidence`;
  }

  private parseTaggingResponse(response: string, mentionId: string): AITaggingResult {
    try {
      const cleaned = response.trim().replace(/```json\n?|\n?```/g, '');
      const parsed = JSON.parse(cleaned);

      return {
        mention_id: mentionId,
        category: parsed.category || 'neutral',
        intent: parsed.intent || 'general_feedback',
        topics: parsed.topics || [],
        priority: ['low', 'medium', 'high'].includes(parsed.priority) ? parsed.priority : 'medium',
        urgency_score: typeof parsed.urgency_score === 'number' ? Math.max(0, Math.min(1, parsed.urgency_score)) : 0.5,
        confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
        reasoning: parsed.reasoning || undefined
      };
    } catch (error) {
      this.logger.warn(`Failed to parse AI tagging response: ${response}`, { mentionId });
      return {
        mention_id: mentionId,
        category: 'neutral',
        intent: 'general_feedback',
        topics: [],
        priority: 'medium',
        urgency_score: 0.5,
        confidence: 0.5,
        reasoning: 'Failed to parse AI response'
      };
    }
  }

  private async findOrCreateCategory(categoryName: string, tenantId: string): Promise<string> {
    // First try to find existing category
    const { data: existing } = await this.supabaseService.adminClient
      .from('tag_categories')
      .select('id')
      .eq('name', categoryName)
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .single();

    if (existing) {
      return existing.id;
    }

    // Create new discovered tag for review
    const discoveredTagData: CreateDiscoveredTagData = {
      tenant_id: tenantId,
      tag_name: categoryName,
      tag_type: 'category',
      confidence_score: 0.7,
      frequency_count: 1,
      created_by_ai: true
    };

    await this.supabaseService.adminClient
      .from('discovered_tags')
      .upsert(discoveredTagData, {
        onConflict: 'tenant_id,tag_name,tag_type'
      });

    // Return a default category ID (neutral)
    const { data: defaultCategory } = await this.supabaseService.adminClient
      .from('tag_categories')
      .select('id')
      .eq('name', 'neutral')
      .single();

    return defaultCategory?.id || '';
  }

  private async findOrCreateIntent(intentName: string, tenantId: string): Promise<string> {
    // First try to find existing intent
    const { data: existing } = await this.supabaseService.adminClient
      .from('tag_intents')
      .select('id')
      .eq('name', intentName)
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
      .single();

    if (existing) {
      return existing.id;
    }

    // Create new discovered tag for review
    const discoveredTagData: CreateDiscoveredTagData = {
      tenant_id: tenantId,
      tag_name: intentName,
      tag_type: 'intent',
      confidence_score: 0.7,
      frequency_count: 1,
      created_by_ai: true
    };

    await this.supabaseService.adminClient
      .from('discovered_tags')
      .upsert(discoveredTagData, {
        onConflict: 'tenant_id,tag_name,tag_type'
      });

    // Return a default intent ID
    const { data: defaultIntent } = await this.supabaseService.adminClient
      .from('tag_intents')
      .select('id')
      .eq('name', 'general_feedback')
      .single();

    return defaultIntent?.id || '';
  }

  private async getMentionTag(mentionId: string, tenantId: string): Promise<MentionTag | null> {
    const { data, error } = await this.supabaseService.adminClient
      .from('mention_tags')
      .select('*')
      .eq('mention_id', mentionId)
      .eq('tenant_id', tenantId)
      .single();

    return data || null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getDefaultPromptContext(): string {
    return 'Analyze the social media mention for general business context. Focus on customer sentiment, feedback type, and any specific business aspects mentioned.';
  }

  async getMentionTags(filter: TagFilterDto, tenantId: string): Promise<{ data: any[]; total: number }> {
    try {
      let query = this.supabaseService.adminClient
        .from('mention_tags')
        .select(`
          *,
          tag_categories(id, name, display_name, color_hex),
          tag_intents(id, name, display_name),
          scraped_mentions(id, content, title, source_type, author, published_at, scraped_at, brands(name))
        `, { count: 'exact' })
        .eq('tenant_id', tenantId);

      // Apply filters
      if (filter.mention_id) query = query.eq('mention_id', filter.mention_id);
      if (filter.category_id) query = query.eq('category_id', filter.category_id);
      if (filter.intent_id) query = query.eq('intent_id', filter.intent_id);
      if (filter.priority) query = query.eq('priority', filter.priority);
      if (filter.start_date) query = query.gte('created_at', filter.start_date);
      if (filter.end_date) query = query.lte('created_at', filter.end_date);

      // Apply pagination
      query = query.order('created_at', { ascending: false })
                   .range(filter.offset || 0, (filter.offset || 0) + (filter.limit || 20) - 1);

      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Failed to fetch mention tags: ${error.message}`);
      }

      return { data: data || [], total: count || 0 };
    } catch (error) {
      this.logger.error(`Error fetching mention tags: ${error.message}`, { tenantId, filter });
      throw error;
    }
  }
}