import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../shared/supabase/supabase.service';
import { OpenAIService, SentimentAnalysisResult } from '../shared/openai/openai.service';
import { SentimentAnalysis } from './entities/sentiment-analysis.entity';
import { ScrapedMention } from '../mentions/entities/mention.entity';
import { LoggerService } from '../../common/logger/logger.service';

@Injectable()
export class SentimentService {
  private logger: ReturnType<LoggerService['setContext']>;
  private readonly AI_MODEL = 'gpt-4.1';
  private readonly AI_PROVIDER = 'openai';
  private readonly ANALYSIS_VERSION = '1.0';

  constructor(
    private supabaseService: SupabaseService,
    private openAIService: OpenAIService,
    private loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.setContext('SentimentService');
  }

  async analyzeMentionSentiment(mention: ScrapedMention, brandName?: string): Promise<SentimentAnalysis | null> {
    this.logger.debug('Starting sentiment analysis for mention', {
      mentionId: mention.id,
      sourceType: mention.source_type,
      brandName,
      author: mention.author,
      contentLength: mention.content?.length || 0
    });

    try {
      // Check if analysis already exists
      const existingAnalysis = await this.findByMentionId(mention.id);
      if (existingAnalysis) {
        this.logger.info('Sentiment analysis already exists', {
          mentionId: mention.id,
          existingSentiment: existingAnalysis.sentiment,
          existingConfidence: existingAnalysis.confidence
        });
        return existingAnalysis;
      }

      // Perform sentiment analysis
      const context = {
        source_type: mention.source_type,
        brand_name: brandName,
        author: mention.author,
      };

      this.logger.debug('Calling OpenAI for sentiment analysis', {
        mentionId: mention.id,
        aiModel: this.AI_MODEL,
        context
      });

      const result = await this.openAIService.analyzeSentiment(mention.content, context);
      
      // Store the result
      const sentimentAnalysis = await this.createSentimentAnalysis(mention, result);
      
      this.logger.info('Sentiment analysis completed successfully', {
        mentionId: mention.id,
        sentiment: result.sentiment,
        confidence: result.confidence,
        aiModel: this.AI_MODEL,
        hasReasoning: !!result.reasoning
      });
      return sentimentAnalysis;

    } catch (error) {
      this.logger.error('Failed to analyze sentiment for mention', {
        error: error.message,
        mentionId: mention.id,
        sourceType: mention.source_type,
        brandName
      });
      return null;
    }
  }

  async batchAnalyzeMentions(mentions: ScrapedMention[], brandName?: string): Promise<SentimentAnalysis[]> {
    this.logger.info('Starting batch sentiment analysis', {
      totalMentions: mentions.length,
      brandName,
      aiModel: this.AI_MODEL
    });

    const results: SentimentAnalysis[] = [];
    
    // Filter out mentions that already have analysis
    const mentionsToAnalyze: ScrapedMention[] = [];
    for (const mention of mentions) {
      const existing = await this.findByMentionId(mention.id);
      if (!existing) {
        mentionsToAnalyze.push(mention);
      }
    }

    this.logger.info('Filtered mentions for analysis', {
      totalMentions: mentions.length,
      alreadyAnalyzed: mentions.length - mentionsToAnalyze.length,
      toAnalyze: mentionsToAnalyze.length,
      brandName
    });

    if (mentionsToAnalyze.length === 0) {
      this.logger.info('No new mentions to analyze - all have existing analysis');
      return results;
    }

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

    this.logger.debug('Prepared batch analysis items', {
      batchSize: batchItems.length,
      brandName
    });

    // Perform batch analysis
    const batchResults = await this.openAIService.batchAnalyzeSentiment(batchItems);

    this.logger.info('Received batch analysis results from OpenAI', {
      requestedCount: batchItems.length,
      receivedCount: batchResults.length,
      brandName
    });

    // Store results
    let successCount = 0;
    let failureCount = 0;

    for (const batchResult of batchResults) {
      const mention = mentionsToAnalyze.find(m => m.id === batchResult.id);
      if (mention) {
        try {
          const sentimentAnalysis = await this.createSentimentAnalysis(mention, batchResult.result);
          if (sentimentAnalysis) {
            results.push(sentimentAnalysis);
            successCount++;
          }
        } catch (error) {
          failureCount++;
          this.logger.error('Failed to store sentiment analysis for mention', {
            error: error.message,
            mentionId: mention.id,
            sentiment: batchResult.result?.sentiment
          });
        }
      }
    }

    this.logger.info('Batch sentiment analysis completed', {
      totalMentions: mentions.length,
      analyzedMentions: mentionsToAnalyze.length,
      successfullyStored: successCount,
      failed: failureCount,
      brandName
    });

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
      this.logger.error('Failed to find sentiment analysis by mention ID', {
        error: error.message,
        mentionId,
        errorCode: error.code
      });
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
      this.logger.error('Failed to find sentiment analyses by tenant', {
        error: error.message,
        tenantId,
        limit,
        offset
      });
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
      this.logger.error('Failed to get sentiment stats', {
        error: error.message,
        tenantId,
        brandId
      });
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

  private convertDate(ddmmyyyy: string): string | null {
    if (!ddmmyyyy) return null;
    const [day, month, year] = ddmmyyyy.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  async getSentimentTrends(
    tenantId: string, 
    brandId?: string, 
    interval: 'day' | 'week' | 'month' = 'day',
    dateFrom?: string,
    dateTo?: string
  ): Promise<any[]> {
    try {
      // Convert dates from DD/MM/YYYY to YYYY-MM-DD format
      const convertedDateFrom = dateFrom 
        ? this.convertDate(dateFrom) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const convertedDateTo = dateTo 
        ? this.convertDate(dateTo) || new Date().toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const { data, error } = await this.supabaseService.adminClient.rpc(
        'get_sentiment_trends_detailed',
        {
          p_tenant_id: tenantId,
          p_brand_id: brandId || null,
          p_date_from: convertedDateFrom,
          p_date_to: convertedDateTo,
          p_interval: interval,
        }
      );

      if (error) {
        throw new Error(`Failed to get sentiment trends: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      this.logger.error('Error getting sentiment trends', {
        error: error.message,
        tenantId,
        brandId,
        interval,
        dateFrom,
        dateTo
      });
      throw error;
    }
  }
}