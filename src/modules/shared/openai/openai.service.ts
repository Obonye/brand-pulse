import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface SentimentAnalysisResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  reasoning?: string;
}

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OpenAI API key not found. Sentiment analysis will be disabled.');
      return;
    }

    this.openai = new OpenAI({
      apiKey,
    });
  }

  async analyzeSentiment(text: string, context?: {
    source_type?: string;
    brand_name?: string;
    author?: string;
  }): Promise<SentimentAnalysisResult> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized. Please check OPENAI_API_KEY.');
    }

    try {
      const prompt = this.buildSentimentPrompt(text, context);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a sentiment analysis expert. Analyze the sentiment of social media mentions and reviews with high accuracy. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 150,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from OpenAI');
      }

      return this.parseSentimentResponse(result);
    } catch (error) {
      this.logger.error(`Sentiment analysis failed: ${error.message}`);
      throw error;
    }
  }

  private buildSentimentPrompt(text: string, context?: {
    source_type?: string;
    brand_name?: string;
    author?: string;
  }): string {
    let prompt = `Analyze the sentiment of the following text and respond in JSON format with sentiment (positive/negative/neutral), confidence (0-1), and brief reasoning.

Text to analyze: "${text}"`;

    if (context) {
      prompt += `\n\nContext:`;
      if (context.source_type) prompt += `\n- Source: ${context.source_type}`;
      if (context.brand_name) prompt += `\n- Brand: ${context.brand_name}`;
      if (context.author) prompt += `\n- Author: ${context.author}`;
    }

    prompt += `\n\nRespond only with valid JSON in this format:
{
  "sentiment": "positive|negative|neutral",
  "confidence": 0.85,
  "reasoning": "Brief explanation"
}`;

    return prompt;
  }

  private parseSentimentResponse(response: string): SentimentAnalysisResult {
    try {
      const cleaned = response.trim().replace(/```json\n?|\n?```/g, '');
      const parsed = JSON.parse(cleaned);
      
      const sentiment = ['positive', 'negative', 'neutral'].includes(parsed.sentiment) 
        ? parsed.sentiment 
        : 'neutral';
      
      const confidence = typeof parsed.confidence === 'number' && parsed.confidence >= 0 && parsed.confidence <= 1
        ? parsed.confidence
        : 0.5;

      return {
        sentiment,
        confidence,
        reasoning: parsed.reasoning || undefined
      };
    } catch (error) {
      this.logger.warn(`Failed to parse sentiment response: ${response}`);
      return {
        sentiment: 'neutral',
        confidence: 0.5,
        reasoning: 'Failed to parse AI response'
      };
    }
  }

  async batchAnalyzeSentiment(
    texts: Array<{ id: string; text: string; context?: any }>
  ): Promise<Array<{ id: string; result: SentimentAnalysisResult }>> {
    const results: Array<{ id: string; result: SentimentAnalysisResult }> = [];
    
    for (const item of texts) {
      try {
        const result = await this.analyzeSentiment(item.text, item.context);
        results.push({ id: item.id, result });
        
        // Rate limiting - OpenAI has limits on requests per minute
        await this.delay(100);
      } catch (error) {
        this.logger.error(`Batch sentiment analysis failed for item ${item.id}: ${error.message}`);
        results.push({
          id: item.id,
          result: {
            sentiment: 'neutral',
            confidence: 0.5,
            reasoning: `Analysis failed: ${error.message}`
          }
        });
      }
    }

    return results;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async healthCheck(): Promise<boolean> {
    if (!this.openai) {
      return false;
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Health check' }],
        max_tokens: 1,
      });
      
      return response.choices?.length > 0;
    } catch (error) {
      this.logger.error(`OpenAI health check failed: ${error.message}`);
      return false;
    }
  }
}