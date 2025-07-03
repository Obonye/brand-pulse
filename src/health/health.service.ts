import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult, HealthIndicator } from '@nestjs/terminus';
import { SupabaseService } from '../modules/shared/supabase/supabase.service';
import { OpenaiService } from '../modules/shared/openai/openai.service';
import { ApifyService } from '../modules/shared/apify/apify.service';

@Injectable()
export class HealthService extends HealthIndicator {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly openaiService: OpenaiService,
    private readonly apifyService: ApifyService,
  ) {
    super();
  }

  async checkSupabase(): Promise<HealthIndicatorResult> {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('brands')
        .select('count')
        .limit(1);

      if (error) {
        throw error;
      }

      return this.getStatus('supabase', true, {
        status: 'connected',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return this.getStatus('supabase', false, {
        status: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async checkOpenAI(): Promise<HealthIndicatorResult> {
    try {
      const isHealthy = await this.openaiService.healthCheck();
      
      return this.getStatus('openai', isHealthy, {
        status: isHealthy ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return this.getStatus('openai', false, {
        status: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async checkApify(): Promise<HealthIndicatorResult> {
    try {
      const isHealthy = await this.apifyService.healthCheck();
      
      return this.getStatus('apify', isHealthy, {
        status: isHealthy ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return this.getStatus('apify', false, {
        status: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}