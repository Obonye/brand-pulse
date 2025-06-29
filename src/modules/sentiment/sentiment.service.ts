import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../shared/supabase/supabase.service';
import { OpenAIService, SentimentAnalysisResult } from '../shared/openai/openai.service';
import { SentimentAnalysis } from './entities/sentiment-analysis.entity';
import { ScrapedMention } from '../mentions/entities/mention.entity';

@Injectable()
export class SentimentService {
  private readonly logger = new Logger(SentimentService.name);
  private readonly AI_MODEL = 'gpt-3.5-turbo';
  private readonly AI_PROVIDER = 'openai';
  private readonly ANALYSIS_VERSION = '1.0';

  constructor(
    private supabaseService: SupabaseService,
    private openAIService: OpenAIService,
  ) {}

  async analyzeMentionSentiment(mention: ScrapedMention, brandName?: string): Promise<SentimentAnalysis | null> {
    try {
      // Check if analysis already exists
      const existingAnalysis = await this.findByMentionId(mention.id);
      if (existingAnalysis) {
        this.logger.log(`Sentiment analysis already exists for mention ${mention.id}`);
        return existingAnalysis;
      }

      // Perform sentiment analysis
      const context = {
        source_type: mention.source_type,
        brand_name: brandName,
        author: mention.author,
      };

      const result = await this.openAIService.analyzeSentiment(mention.content, context);
      
      // Store the result
      const sentimentAnalysis = await this.createSentimentAnalysis(mention, result);
      
      this.logger.log(`Sentiment analysis completed for mention ${mention.id}: ${result.sentiment} (${result.confidence})`);
      return sentimentAnalysis;

    } catch (error) {
      this.logger.error(`Failed to analyze sentiment for mention ${mention.id}: ${error.message}`);
      return null;
    }
  }

  async batchAnalyzeMentions(mentions: ScrapedMention[], brandName?: string): Promise<SentimentAnalysis[]> {
    const results: SentimentAnalysis[] = [];
    
    // Filter out mentions that already have analysis
    const mentionsToAnalyze: ScrapedMention[] = [];
    for (const mention of mentions) {
      const existing = await this.findByMentionId(mention.id);
      if (!existing) {
        mentionsToAnalyze.push(mention);
      }
    }

    if (mentionsToAnalyze.length === 0) {
      this.logger.log('No new mentions to analyze');
      return results;
    }

    this.logger.log(`Analyzing sentiment for ${mentionsToAnalyze.length} mentions`);

    // Prepare batch analysis
    const batchItems = mentionsToAnalyze.map(mention => ({
      id: mention.id,
      text: mention.content,
      context: {
        source_type: mention.source_type,
        brand_name: brandName,
        author: mention.author,
      }
    }));

    // Perform batch analysis
    const batchResults = await this.openAIService.batchAnalyzeSentiment(batchItems);

    // Store results
    for (const batchResult of batchResults) {
      const mention = mentionsToAnalyze.find(m => m.id === batchResult.id);
      if (mention) {
        try {
          const sentimentAnalysis = await this.createSentimentAnalysis(mention, batchResult.result);
          if (sentimentAnalysis) {
            results.push(sentimentAnalysis);
          }
        } catch (error) {
          this.logger.error(`Failed to store sentiment analysis for mention ${mention.id}: ${error.message}`);
        }
      }
    }

    this.logger.log(`Successfully analyzed sentiment for ${results.length} mentions`);
    return results;
  }

  private async createSentimentAnalysis(mention: ScrapedMention, result: SentimentAnalysisResult): Promise<SentimentAnalysis> {
    const sentimentData = {
      mention_id: mention.id,
      tenant_id: mention.tenant_id,
      sentiment: result.sentiment,
      confidence: result.confidence,
      reasoning: result.reasoning,
      ai_model: this.AI_MODEL,
      ai_provider: this.AI_PROVIDER,
      analysis_version: this.ANALYSIS_VERSION,
    };

    const { data, error } = await this.supabaseService.adminClient
      .from('sentiment_analysis')
      .insert(sentimentData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create sentiment analysis: ${error.message}`);
    }

    return data;
  }

  async findByMentionId(mentionId: string): Promise<SentimentAnalysis | null> {
    const { data, error } = await this.supabaseService.adminClient
      .from('sentiment_analysis')
      .select('*')
      .eq('mention_id', mentionId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      this.logger.error(`Failed to find sentiment analysis: ${error.message}`);
      return null;
    }

    return data;
  }

  async findByTenantId(tenantId: string, limit = 100, offset = 0): Promise<SentimentAnalysis[]> {
    const { data, error } = await this.supabaseService.adminClient
      .from('sentiment_analysis')
      .select(`
        *,
        scraped_mention:scraped_mentions!inner (
          id,
          content,
          brand_id,
          source_type,
          author,
          published_at,
          brands (
            id,
            name
          )
        )
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error(`Failed to find sentiment analyses: ${error.message}`);
      return [];
    }

    return data || [];
  }

  async getSentimentStats(tenantId: string, brandId?: string): Promise<{
    total: number;
    positive: number;
    negative: number;
    neutral: number;
    average_confidence: number;
  }> {
    let query = this.supabaseService.adminClient
      .from('sentiment_analysis')
      .select(`
        sentiment,
        confidence,
        scraped_mention:scraped_mentions!inner (brand_id)
      `)
      .eq('tenant_id', tenantId);

    if (brandId) {
      query = query.eq('scraped_mention.brand_id', brandId);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Failed to get sentiment stats: ${error.message}`);
      return { total: 0, positive: 0, negative: 0, neutral: 0, average_confidence: 0 };
    }

    const stats = data.reduce(
      (acc, item) => {
        acc.total++;
        acc[item.sentiment]++;
        acc.total_confidence += item.confidence;
        return acc;
      },
      { total: 0, positive: 0, negative: 0, neutral: 0, total_confidence: 0 }
    );

    return {
      total: stats.total,
      positive: stats.positive,
      negative: stats.negative,
      neutral: stats.neutral,
      average_confidence: stats.total > 0 ? stats.total_confidence / stats.total : 0,
    };
  }
}