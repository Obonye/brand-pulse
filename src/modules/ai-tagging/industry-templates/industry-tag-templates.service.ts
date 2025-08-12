import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../shared/supabase/supabase.service';
import { IndustryTagTemplate } from '../entities/industry-tag-template.entity';
import { LoggerService } from '../../../common/logger/logger.service';

@Injectable()
export class IndustryTagTemplatesService {
  private logger: ReturnType<LoggerService['setContext']>;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.setContext('IndustryTagTemplatesService');
  }

  async getTemplateByIndustryId(industryId: string): Promise<IndustryTagTemplate[]> {
    try {
      const { data, error } = await this.supabaseService.adminClient
        .from('industry_tag_templates')
        .select('*')
        .eq('industry_id', industryId);

      if (error) {
        this.logger.error(`Failed to fetch industry tag templates: ${error.message}`, { industryId });
        return [];
      }

      this.logger.debug('Industry tag templates fetched successfully', { 
        industryId, 
        count: data?.length || 0 
      });

      return data || [];
    } catch (error) {
      this.logger.error(`Error fetching industry tag templates: ${error.message}`, { industryId });
      return [];
    }
  }

  async getTemplateByIndustryName(industryName: string): Promise<IndustryTagTemplate[]> {
    try {
      const { data, error } = await this.supabaseService.adminClient
        .from('industry_tag_templates')
        .select(`
          *,
          industries!inner(id, name, display_name)
        `)
        .eq('industries.name', industryName);

      if (error) {
        this.logger.error(`Failed to fetch industry tag templates by name: ${error.message}`, { industryName });
        return [];
      }

      this.logger.debug('Industry tag templates fetched by name successfully', { 
        industryName, 
        count: data?.length || 0 
      });

      return data || [];
    } catch (error) {
      this.logger.error(`Error fetching industry tag templates by name: ${error.message}`, { industryName });
      return [];
    }
  }

  async getAllTemplates(): Promise<IndustryTagTemplate[]> {
    try {
      const { data, error } = await this.supabaseService.adminClient
        .from('industry_tag_templates')
        .select(`
          *,
          industries(id, name, display_name)
        `)
        .order('industries.display_name');

      if (error) {
        this.logger.error(`Failed to fetch all industry tag templates: ${error.message}`);
        return [];
      }

      this.logger.debug('All industry tag templates fetched successfully', { 
        count: data?.length || 0 
      });

      return data || [];
    } catch (error) {
      this.logger.error(`Error fetching all industry tag templates: ${error.message}`);
      return [];
    }
  }

  async getPromptContextForIndustry(industryId: string): Promise<string> {
    try {
      const templates = await this.getTemplateByIndustryId(industryId);
      
      if (templates.length === 0) {
        this.logger.warn('No templates found for industry, using general context', { industryId });
        return this.getDefaultPromptContext();
      }

      // Combine all contexts and topics/intents from templates
      const contexts = templates.map(template => template.ai_prompt_context).filter(Boolean);
      const allTopics = new Set<string>();
      const allIntents = new Set<string>();

      templates.forEach(template => {
        template.topics.forEach(topic => allTopics.add(topic));
        template.intents.forEach(intent => allIntents.add(intent));
      });

      const combinedContext = contexts.length > 0 ? contexts.join(' ') : this.getDefaultPromptContext();
      
      this.logger.debug('AI prompt context generated for industry', { 
        industryId,
        contextsFound: contexts.length,
        totalTopics: allTopics.size,
        totalIntents: allIntents.size
      });

      return `${combinedContext}\n\nAvailable topics: ${Array.from(allTopics).join(', ')}\nAvailable intents: ${Array.from(allIntents).join(', ')}`;
    } catch (error) {
      this.logger.error(`Error getting prompt context for industry: ${error.message}`, { industryId });
      return this.getDefaultPromptContext();
    }
  }

  private getDefaultPromptContext(): string {
    return `Analyze the social media mention for general business context. Focus on customer sentiment, feedback type, and any specific business aspects mentioned. Consider customer service quality, product/service feedback, and overall customer experience.`;
  }

  async getTopicsForIndustry(industryId: string): Promise<string[]> {
    try {
      const templates = await this.getTemplateByIndustryId(industryId);
      const allTopics = new Set<string>();

      templates.forEach(template => {
        template.topics.forEach(topic => allTopics.add(topic));
      });

      this.logger.debug('Topics retrieved for industry', { 
        industryId,
        topicsCount: allTopics.size
      });

      return Array.from(allTopics).sort();
    } catch (error) {
      this.logger.error(`Error getting topics for industry: ${error.message}`, { industryId });
      return [];
    }
  }

  async getIntentsForIndustry(industryId: string): Promise<string[]> {
    try {
      const templates = await this.getTemplateByIndustryId(industryId);
      const allIntents = new Set<string>();

      templates.forEach(template => {
        template.intents.forEach(intent => allIntents.add(intent));
      });

      this.logger.debug('Intents retrieved for industry', { 
        industryId,
        intentsCount: allIntents.size
      });

      return Array.from(allIntents).sort();
    } catch (error) {
      this.logger.error(`Error getting intents for industry: ${error.message}`, { industryId });
      return [];
    }
  }
}