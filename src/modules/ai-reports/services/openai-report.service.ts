import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ReportInsights } from '../interfaces/report-data.interface';

@Injectable()
export class OpenAIReportService {
  private readonly logger = new Logger(OpenAIReportService.name);
  private readonly openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for AI report generation');
    }

    this.openai = new OpenAI({
      apiKey: apiKey,
      timeout: 60000, // 60 second timeout
    });
  }

  /**
   * Generate AI report content using OpenAI
   */
  async generateReport(
    insights: ReportInsights,
    reportType: string,
    customInstructions?: string
  ): Promise<{
    content: string;
    summary: string;
    processingTime: number;
    tokensUsed: number;
    model: string;
  }> {
    const startTime = Date.now();

    try {
      this.logger.debug(`Generating AI report`, {
        reportType,
        totalMentions: insights.totalMentions,
        dateRange: insights.dateRange
      });

      const prompt = this.buildPrompt(insights, reportType, customInstructions);
      const model = this.getModelForReportType(reportType);

      const completion = await this.openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: this.getSystemPrompt(reportType)
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3, // Lower temperature for consistent, factual reports
        max_tokens: this.getMaxTokensForReportType(reportType),
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content generated from OpenAI');
      }

      // Extract summary from content (first paragraph or executive summary section)
      const summary = this.extractSummary(content, reportType);
      
      const processingTime = Date.now() - startTime;
      const tokensUsed = completion.usage?.total_tokens || 0;

      this.logger.log(`Successfully generated AI report`, {
        reportType,
        processingTime,
        tokensUsed,
        model,
        contentLength: content.length
      });

      return {
        content,
        summary,
        processingTime,
        tokensUsed,
        model
      };

    } catch (error) {
      this.logger.error(`Failed to generate AI report`, {
        error: error.message,
        reportType,
        insights: {
          totalMentions: insights.totalMentions,
          dateRange: insights.dateRange
        }
      });
      throw new Error(`AI report generation failed: ${error.message}`);
    }
  }

  /**
   * Build the prompt for OpenAI based on report type and insights
   */
  private buildPrompt(
    insights: ReportInsights,
    reportType: string,
    customInstructions?: string
  ): string {
    const baseContext = `
    Analyze the following brand monitoring data and create a comprehensive ${reportType} report:

    SUMMARY METRICS:
    - Total mentions: ${insights.totalMentions}
    - Date range: ${insights.dateRange.from} to ${insights.dateRange.to}
    - Sentiment: ${insights.sentimentBreakdown.positive} positive (${((insights.sentimentBreakdown.positive/insights.totalMentions)*100).toFixed(1)}%), ${insights.sentimentBreakdown.negative} negative (${((insights.sentimentBreakdown.negative/insights.totalMentions)*100).toFixed(1)}%), ${insights.sentimentBreakdown.neutral} neutral (${((insights.sentimentBreakdown.neutral/insights.totalMentions)*100).toFixed(1)}%)
    - Average sentiment confidence: ${insights.sentimentBreakdown.avgConfidence.toFixed(2)}
    - High priority issues: ${insights.priorityBreakdown.high}
    - Average urgency score: ${insights.priorityBreakdown.avgUrgency.toFixed(2)}
    - Unique contributors: ${insights.uniqueAuthors}
    
    TOP CATEGORIES: ${JSON.stringify(insights.topCategories, null, 2)}
    TOP TOPICS: ${JSON.stringify(insights.topTopics, null, 2)}
    TOP SOURCE TYPES: ${JSON.stringify(insights.topSourceTypes, null, 2)}

    ${insights.highPriorityMentions.length > 0 ? `
    HIGH PRIORITY MENTIONS:
    ${insights.highPriorityMentions.map(m => `- "${m.content.substring(0, 150)}..." (${m.source_type}, ${m.sentiment}, urgency: ${m.max_urgency_score})`).join('\n')}
    ` : ''}

    ${insights.positiveMentions.length > 0 ? `
    POSITIVE HIGHLIGHTS:
    ${insights.positiveMentions.map(m => `- "${m.content.substring(0, 150)}..." (${m.source_type}, confidence: ${m.sentiment_confidence})`).join('\n')}
    ` : ''}

    ${insights.negativeMentions.length > 0 ? `
    NEGATIVE CONCERNS:
    ${insights.negativeMentions.map(m => `- "${m.content.substring(0, 150)}..." (${m.source_type}, confidence: ${m.sentiment_confidence})`).join('\n')}
    ` : ''}

    DATA QUALITY NOTES:
    - Only tags with ≥${insights.confidenceThresholds.tags} confidence included
    - Only topics with ≥${insights.confidenceThresholds.topics} confidence included
    `;

    const reportInstructions = this.getReportTypeInstructions(reportType);
    const customSection = customInstructions ? `\n\nADDITIONAL REQUIREMENTS:\n${customInstructions}` : '';

    return baseContext + reportInstructions + customSection;
  }

  /**
   * Get system prompt based on report type
   */
  private getSystemPrompt(reportType: string): string {
    const basePrompt = `You are a business intelligence analyst creating actionable reports from brand monitoring data. Focus on insights, trends, and specific recommendations.`;

    const typeSpecificPrompts = {
      'executive-summary': `${basePrompt} Create executive-level insights that are clear, concise, and actionable for leadership decision-making.`,
      'sentiment-intelligence': `${basePrompt} Focus on deep sentiment analysis, emotional patterns, and psychological insights about brand perception.`,
      'competitive-analysis': `${basePrompt} Analyze competitive positioning, market dynamics, and strategic opportunities relative to competitors.`,
      'category-performance': `${basePrompt} Provide detailed analysis of performance across different categories, intents, and topics with actionable recommendations.`,
      'crisis-alert': `${basePrompt} Focus on urgency, immediate action items, and crisis management with clear priorities and timelines.`,
      'trend-analysis': `${basePrompt} Identify patterns, predict future trends, and provide forward-looking strategic insights.`
    };

    return typeSpecificPrompts[reportType] || basePrompt;
  }

  /**
   * Get report type specific instructions
   */
  private getReportTypeInstructions(reportType: string): string {
    const instructions = {
      'executive-summary': `
        Create an executive summary focusing on:
        - 3-sentence executive overview highlighting the most critical insights
        - Brand health status with clear metrics and trends
        - Critical issues requiring immediate attention (if any)
        - Key opportunities and positive momentum to leverage
        - 3-4 specific strategic recommendations with expected outcomes
        - Competitive positioning insights (if applicable)
        
        Format with clear sections, bullet points, and specific metrics. Keep language executive-friendly and action-oriented.`,
      
      'sentiment-intelligence': `
        Create a sentiment analysis report focusing on:
        - Emotional patterns and sentiment drivers analysis
        - Topic-sentiment correlations and what drives positive/negative feelings
        - Author influence analysis and engagement patterns
        - Sentiment confidence analysis and data quality insights
        - Specific recommendations for sentiment improvement
        - Anomalies or unexpected sentiment patterns
        
        Provide psychological insights into brand perception and emotional triggers.`,
        
      'competitive-analysis': `
        Create a competitive analysis report focusing on:
        - Market positioning relative to competitors
        - Share of voice analysis and competitive gaps
        - Competitive strengths and weaknesses identification
        - Emerging threats and opportunities in the competitive landscape
        - Strategic recommendations for competitive advantage
        - Market trends that affect competitive positioning
        
        Be specific about competitive dynamics and strategic implications.`,
        
      'category-performance': `
        Create a category performance report focusing on:
        - Performance analysis across AI tag categories and intents
        - Priority distribution and urgency patterns by category
        - Category-specific trends and anomalies
        - Intent analysis and what drives different customer behaviors
        - Specific action items and recommendations for each major category
        - Cross-category insights and optimization opportunities
        
        Provide category-specific actionable recommendations.`,
        
      'crisis-alert': `
        Create a crisis alert report focusing on:
        - Immediate threats requiring urgent response (if any)
        - Escalation risk assessment and timeline
        - Specific response recommendations with priorities
        - Stakeholder notification requirements
        - Crisis mitigation strategies and action plans
        - Monitoring recommendations for ongoing situation management
        
        Use urgent, clear language with specific timelines and action items. If no crisis exists, explain the current stability.`,
        
      'trend-analysis': `
        Create a trend analysis report focusing on:
        - Emerging topics and themes identification
        - Trend momentum and direction analysis
        - Predictive insights about future developments
        - Seasonal patterns and cyclical behaviors
        - Opportunity identification from trend analysis
        - Strategic recommendations for trend capitalization
        
        Focus on forward-looking insights and strategic implications.`
    };

    return instructions[reportType] || instructions['executive-summary'];
  }

  /**
   * Extract summary from generated content
   */
  private extractSummary(content: string, reportType: string): string {
    // Look for executive overview, summary, or key takeaways sections
    const summaryPatterns = [
      /(?:Executive Overview|Key Takeaways|Summary)[\s\S]*?(?=\n\n|\n#|\n\*\*|$)/i,
      /^.*?(?=\n\n|\n#|\n\*\*)/,  // First paragraph
    ];

    for (const pattern of summaryPatterns) {
      const match = content.match(pattern);
      if (match && match[0].length > 50) {
        return match[0].trim();
      }
    }

    // Fallback: use first 300 characters
    return content.substring(0, 300).trim() + (content.length > 300 ? '...' : '');
  }

  /**
   * Get appropriate model for report type
   */
  private getModelForReportType(reportType: string): string {
    // Use GPT-4 for complex analysis, GPT-3.5-turbo for simpler reports
    const complexReports = ['competitive-analysis', 'sentiment-intelligence', 'trend-analysis'];
    
    if (complexReports.includes(reportType)) {
      return 'gpt-4o';
    }
    
    return 'gpt-4o-mini'; // Faster and cheaper for executive summaries and alerts
  }

  /**
   * Get max tokens for report type
   */
  private getMaxTokensForReportType(reportType: string): number {
    const tokenLimits = {
      'crisis-alert': 2000,        // Shorter, more focused
      'executive-summary': 3000,   // Concise executive content
      'category-performance': 4000, // Detailed category analysis
      'sentiment-intelligence': 4000, // Deep sentiment analysis
      'competitive-analysis': 5000,   // Comprehensive competitive insights
      'trend-analysis': 4000       // Forward-looking analysis
    };

    return tokenLimits[reportType] || 3000;
  }

  /**
   * Validate OpenAI configuration
   */
  async validateConfiguration(): Promise<{ isValid: boolean; error?: string }> {
    try {
      // Test with a simple completion
      await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 10
      });
      
      return { isValid: true };
    } catch (error) {
      this.logger.error('OpenAI configuration validation failed', error);
      return { 
        isValid: false, 
        error: `OpenAI configuration invalid: ${error.message}` 
      };
    }
  }

  /**
   * Get OpenAI usage statistics
   */
  getUsageStats(): {
    modelConfigured: string;
    timeoutMs: number;
    isConfigured: boolean;
  } {
    return {
      modelConfigured: 'gpt-4o / gpt-4o-mini',
      timeoutMs: 60000,
      isConfigured: !!this.openai
    };
  }
}