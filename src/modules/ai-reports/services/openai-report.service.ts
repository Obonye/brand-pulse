import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ReportInsights, StreamlinedInsights } from '../interfaces/report-data.interface';

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
    insights: StreamlinedInsights,
    reportType: string,
    customInstructions?: string
  ): Promise<{
    recommendations: any;
    actions: any;
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

      // Extract structured content from AI response
      const summary = this.extractSummary(content, reportType);
      const recommendations = this.extractRecommendations(content, reportType);
      const actions = this.extractActions(content, reportType);
      
      // Debug logging to see what we extracted
      this.logger.debug(`AI Content Extraction Results`, {
        reportType,
        contentLength: content.length,
        extractedRecommendations: recommendations,
        extractedActions: actions,
        summaryLength: summary.length,
        // Show first 500 chars of content for debugging
        contentPreview: content.substring(0, 500)
      });
      
      const processingTime = Date.now() - startTime;
      const tokensUsed = completion.usage?.total_tokens || 0;

      this.logger.log(`Successfully generated AI report`, {
        reportType,
        processingTime,
        tokensUsed,
        model,
        contentLength: content.length,
        recommendationsExtracted: recommendations.length,
        actionsExtracted: actions.length,
        hasRecommendations: recommendations.length > 0,
        hasActions: actions.length > 0
      });

      return {
        recommendations,
        actions,
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
    insights: StreamlinedInsights,
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
    
    TOP TOPICS: ${JSON.stringify(insights.topTopics, null, 2)}
    TOP SOURCE TYPES: ${JSON.stringify(insights.topSourceTypes, null, 2)}

    DATA QUALITY NOTES:
    - Only tags with ≥${insights.confidenceThresholds.tags} confidence included
    - Only topics with ≥${insights.confidenceThresholds.topics} confidence included
    
    FOCUS: Since this analysis is based on aggregated data and top-level insights, please focus on strategic recommendations and actionable insights rather than individual mention details.
    `;

    const reportInstructions = this.getReportTypeInstructions(reportType);
    const customSection = customInstructions ? `\n\nADDITIONAL REQUIREMENTS:\n${customInstructions}` : '';
    
    const formatReminder = `\n\nIMPORTANT: Always include properly formatted Recommendations and/or Actions sections using bullet points (•) as shown in the instructions above. These sections are critical for the report functionality.`;

    return baseContext + reportInstructions + customSection + formatReminder;
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
        - MUST INCLUDE: Strategic Recommendations section formatted as:
          ## Recommendations
          • [Specific actionable recommendation 1]
          • [Specific actionable recommendation 2]
          • [Specific actionable recommendation 3]
          • [Specific actionable recommendation 4]
        - Competitive positioning insights (if applicable)
        
        Format with clear sections, bullet points, and specific metrics. Keep language executive-friendly and action-oriented.`,
      
      'sentiment-intelligence': `
        Create a sentiment analysis report focusing on:
        - Emotional patterns and sentiment drivers analysis
        - Topic-sentiment correlations and what drives positive/negative feelings
        - Author influence analysis and engagement patterns
        - Sentiment confidence analysis and data quality insights
        - MUST INCLUDE: Recommendations section formatted as:
          ## Recommendations
          • [Specific step to improve sentiment 1]
          • [Specific step to improve sentiment 2]
          • [Specific step to improve sentiment 3]
          • [Specific step to improve sentiment 4]
        - Anomalies or unexpected sentiment patterns
        
        Provide psychological insights into brand perception and emotional triggers.`,
        
      'competitive-analysis': `
        Create a competitive analysis report focusing on:
        - Market positioning relative to competitors
        - Share of voice analysis and competitive gaps
        - Competitive strengths and weaknesses identification
        - Emerging threats and opportunities in the competitive landscape
        - MUST INCLUDE: Strategic Recommendations section formatted as:
          ## Recommendations
          • [Specific competitive advantage recommendation 1]
          • [Specific competitive advantage recommendation 2]
          • [Specific competitive advantage recommendation 3]
          • [Specific competitive advantage recommendation 4]
        - Market trends that affect competitive positioning
        
        Be specific about competitive dynamics and strategic implications.`,
        
      'category-performance': `
        Create a category performance report focusing on:
        - Performance analysis across AI tag categories and intents
        - Priority distribution and urgency patterns by category
        - Category-specific trends and anomalies
        - Intent analysis and what drives different customer behaviors
        - MUST INCLUDE: Recommendations section formatted as:
          ## Recommendations
          • [Category-specific optimization recommendation 1]
          • [Category-specific optimization recommendation 2]
          • [Category-specific optimization recommendation 3]
          • [Category-specific optimization recommendation 4]
        - Cross-category insights and optimization opportunities
        
        Provide category-specific actionable recommendations.`,
        
      'crisis-alert': `
        Create a crisis alert report focusing on:
        - Immediate threats requiring urgent response (if any)
        - Escalation risk assessment and timeline
        - MUST INCLUDE: Immediate Actions section formatted as:
          ## Actions
          • [Immediate action with timeline 1]
          • [Immediate action with timeline 2]
          • [Immediate action with timeline 3]
          • [Immediate action with timeline 4]
        - MUST INCLUDE: Recommendations section formatted as:
          ## Recommendations
          • [Strategic crisis management recommendation 1]
          • [Strategic crisis management recommendation 2]
          • [Strategic crisis management recommendation 3]
        - Stakeholder notification requirements
        - Monitoring recommendations for ongoing situation management
        
        Use urgent, clear language with specific timelines and action items. If no crisis exists, explain the current stability.`,
        
      'trend-analysis': `
        Create a trend analysis report focusing on:
        - Emerging topics and themes identification
        - Trend momentum and direction analysis
        - Predictive insights about future developments
        - Seasonal patterns and cyclical behaviors
        - Opportunity identification from trend analysis
        - MUST INCLUDE: Strategic Recommendations section formatted as:
          ## Recommendations
          • [Trend capitalization recommendation 1]
          • [Trend capitalization recommendation 2]
          • [Trend capitalization recommendation 3]
          • [Trend capitalization recommendation 4]
        
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
   * Extract recommendations from AI-generated content
   */
  private extractRecommendations(content: string, reportType: string): string[] {
    const recommendations: string[] = [];

    // Look for recommendations sections with various headers including markdown format
    const recommendationPatterns = [
      /##\s*Recommendations?\s*\n((?:[•\-*]\s*.+\n?)+)/gi,
      /(?:Recommendations?|Strategic Recommendations?|Action Items?|Next Steps?)[\s:]*\n((?:[•\-*]\s*.+\n?)+)/gi,
      /(?:Key Recommendations?|Priority Actions?|Strategic Actions?)[\s:]*\n((?:[•\-*]\s*.+\n?)+)/gi,
      /(?:\d+\.\s*(?:Recommendations?|Actions?|Steps?))[\s\S]*?(?=\n\d+\.|\n\n|\n#|$)/gi
    ];

    for (const pattern of recommendationPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          // Extract individual bullet points
          const bulletPoints = match[1]
            .split('\n')
            .map(line => line.replace(/^[•\-*]\s*/, '').trim())
            .filter(line => line.length > 10);
          
          recommendations.push(...bulletPoints);
        } else if (match[0]) {
          // Extract full matched text and clean it
          const cleanText = match[0]
            .replace(/^(?:Key Recommendations?|Strategic Recommendations?|Recommendations?|Action Items?|Next Steps?)[\s:]*\n?/i, '')
            .trim();
          
          if (cleanText.length > 20) {
            recommendations.push(cleanText);
          }
        }
      }
    }

    // Also look for numbered lists that might be recommendations
    const numberedPatterns = [
      /\d+\.\s*(?:Implement|Develop|Create|Focus|Improve|Address|Monitor|Review|Consider|Evaluate|Establish).+?(?=\n\d+\.|\n\n|$)/gi
    ];

    for (const pattern of numberedPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const cleanText = match[0].replace(/^\d+\.\s*/, '').trim();
        if (cleanText.length > 20 && !recommendations.some(r => r.includes(cleanText.substring(0, 50)))) {
          recommendations.push(cleanText);
        }
      }
    }

    // Remove duplicates and clean up
    const uniqueRecommendations = [...new Set(recommendations)]
      .map(r => r.replace(/\s+/g, ' ').trim())
      .filter(r => r.length > 15)
      .slice(0, 10); // Limit to 10 recommendations

    return uniqueRecommendations;
  }

  /**
   * Extract actionable steps/actions from AI-generated content
   */
  private extractActions(content: string, reportType: string): string[] {
    const actions: string[] = [];

    // Look for immediate actions, urgent steps, crisis responses including markdown format
    const actionPatterns = [
      /##\s*Actions?\s*\n((?:[•\-*]\s*.+\n?)+)/gi,
      /(?:Immediate Actions?|Urgent Steps?|Priority Actions?|Action Plan)[\s:]*\n((?:[•\-*]\s*.+\n?)+)/gi,
      /(?:Crisis Response|Immediate Response|Next Steps?)[\s:]*\n((?:[•\-*]\s*.+\n?)+)/gi,
    ];

    for (const pattern of actionPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          const bulletPoints = match[1]
            .split('\n')
            .map(line => line.replace(/^[•\-*]\s*/, '').trim())
            .filter(line => line.length > 10);
          
          actions.push(...bulletPoints);
        }
      }
    }

    // For crisis reports, extract timeline-based actions
    if (reportType === 'crisis-alert') {
      const timelinePatterns = [
        /(?:Within|Next|Immediate|24 hours?|48 hours?|This week).*?(?=\n|$)/gi
      ];

      for (const pattern of timelinePatterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          const actionText = match[0].trim();
          if (actionText.length > 20 && !actions.some(a => a.includes(actionText.substring(0, 30)))) {
            actions.push(actionText);
          }
        }
      }
    }

    // Extract verb-based action items
    const verbPatterns = [
      /(?:^|\n)[-*•]?\s*(?:Monitor|Track|Review|Investigate|Contact|Schedule|Update|Alert|Notify|Escalate|Implement|Execute).+?(?=\n|$)/gim
    ];

    for (const pattern of verbPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const cleanText = match[0].replace(/^[-*•]\s*/, '').trim();
        if (cleanText.length > 15 && !actions.some(a => a.includes(cleanText.substring(0, 30)))) {
          actions.push(cleanText);
        }
      }
    }

    // Remove duplicates and clean up
    const uniqueActions = [...new Set(actions)]
      .map(a => a.replace(/\s+/g, ' ').trim())
      .filter(a => a.length > 10)
      .slice(0, 8); // Limit to 8 actions

    return uniqueActions;
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