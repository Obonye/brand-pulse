import { Controller, Post, Body, Headers, Logger, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ScraperJobsService } from './scraper-jobs.service';
import { SupabaseService } from '../shared/supabase/supabase.service';
import { MentionsService } from '../mentions/mentions.service';
import { ApifyService } from '../shared/apify/apify.service';

export interface ApifyWebhookPayload {
  eventType: 'ACTOR.RUN.SUCCEEDED' | 'ACTOR.RUN.FAILED' | 'ACTOR.RUN.ABORTED' | 'ACTOR.RUN.TIMED_OUT';
  eventData: {
    actorId: string;
    actorRunId: string;
    actorTaskId?: string;
    userId: string;
  };
  createdAt: string;
}

@ApiTags('Apify Webhooks')
@Controller('webhooks/apify')
export class ApifyWebhookController {
  private readonly logger = new Logger(ApifyWebhookController.name);

  constructor(
    private readonly scraperJobsService: ScraperJobsService,
    private readonly supabaseService: SupabaseService,
    private readonly mentionsService: MentionsService,
    private readonly apifyService: ApifyService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Handle Apify webhook notifications' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload' })
  async handleWebhook(
    @Body() payload: ApifyWebhookPayload,
    @Headers('x-apify-webhook-signature') signature?: string,
  ): Promise<{ status: string; message: string }> {
    try {
      this.logger.log(`Received Apify webhook: ${payload.eventType} for run ${payload.eventData.actorRunId}`);

      // Validate webhook payload
      if (!payload.eventType || !payload.eventData?.actorRunId) {
        throw new BadRequestException('Invalid webhook payload');
      }

      // Find the scraper run by Apify run ID
      const { data: scraperRun, error: findError } = await this.supabaseService.adminClient
        .from('scraper_runs')
        .select(`
          *,
          scraper_jobs (
            id,
            tenant_id,
            name,
            brand_id,
            source_type
          )
        `)
        .eq('apify_run_id', payload.eventData.actorRunId)
        .single();

      if (findError || !scraperRun) {
        this.logger.warn(`Scraper run not found for Apify run ID: ${payload.eventData.actorRunId}`);
        return { status: 'ignored', message: 'Scraper run not found' };
      }

      // Update scraper run status based on webhook event
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      switch (payload.eventType) {
        case 'ACTOR.RUN.SUCCEEDED':
          updateData.status = 'completed';
          updateData.finished_at = new Date().toISOString();
          updateData.metadata = {
            ...scraperRun.metadata,
            apify_webhook_received: true,
            webhook_event: payload.eventType,
            webhook_received_at: new Date().toISOString(),
          };
          break;

        case 'ACTOR.RUN.FAILED':
        case 'ACTOR.RUN.ABORTED':
        case 'ACTOR.RUN.TIMED_OUT':
          updateData.status = 'failed';
          updateData.finished_at = new Date().toISOString();
          updateData.error_message = `Apify run ${payload.eventType.toLowerCase().replace('actor.run.', '')}`;
          updateData.metadata = {
            ...scraperRun.metadata,
            apify_webhook_received: true,
            webhook_event: payload.eventType,
            webhook_received_at: new Date().toISOString(),
          };
          break;

        default:
          this.logger.warn(`Unhandled webhook event type: ${payload.eventType}`);
          return { status: 'ignored', message: 'Unhandled event type' };
      }

      // Update the scraper run
      const { error: updateError } = await this.supabaseService.adminClient
        .from('scraper_runs')
        .update(updateData)
        .eq('id', scraperRun.id);

      if (updateError) {
        this.logger.error(`Failed to update scraper run: ${updateError.message}`);
        throw new BadRequestException(`Failed to update scraper run: ${updateError.message}`);
      }

      // If run completed successfully, trigger data processing
      if (payload.eventType === 'ACTOR.RUN.SUCCEEDED') {
        await this.processCompletedRun(scraperRun);
      }

      this.logger.log(`Successfully processed webhook for run ${scraperRun.id}`);
      return { status: 'success', message: 'Webhook processed successfully' };

    } catch (error) {
      this.logger.error(`Failed to process Apify webhook: ${error.message}`, error.stack);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to process webhook');
    }
  }

  private async processCompletedRun(scraperRun: any): Promise<void> {
    try {
      this.logger.log(`Processing completed run data for scraper run ${scraperRun.id}`);

      // Check if this is an Instagram posts scraper that needs comment processing
      if (scraperRun.scraper_jobs.source_type === 'instagram' && !scraperRun.metadata?.is_comments_scraper) {
        await this.handleInstagramPostsCompleted(scraperRun);
        return; // Don't process mentions yet, wait for comments scraper
      }

      // Process and store mentions from Apify run
      await this.mentionsService.processApifyRunData(scraperRun);

      // Update run with processing completion
      await this.supabaseService.adminClient
        .from('scraper_runs')
        .update({
          metadata: {
            ...scraperRun.metadata,
            data_processed: true,
            data_processed_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', scraperRun.id);

      this.logger.log(`Successfully processed mentions for run ${scraperRun.id}`);

    } catch (error) {
      this.logger.error(`Failed to process completed run data: ${error.message}`, error.stack);
      
      // Update run with processing error
      await this.supabaseService.adminClient
        .from('scraper_runs')
        .update({
          metadata: {
            ...scraperRun.metadata,
            data_processing_error: error.message,
            data_processing_failed_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', scraperRun.id);
    }
  }

  private async handleInstagramPostsCompleted(scraperRun: any): Promise<void> {
    try {
      this.logger.log(`Handling Instagram posts completion for run ${scraperRun.id}`);

      // Get the post URLs from the completed Instagram posts scraper
      const postsData = await this.apifyService.getRunData(scraperRun.apify_run_id);
      
      if (!postsData || postsData.length === 0) {
        this.logger.warn(`No posts data found for Instagram run ${scraperRun.id}`);
        return;
      }

      // Extract post URLs
      const postUrls = postsData
        .filter(item => item.url || item.postUrl || item.shortCode)
        .map(item => {
          // Handle different URL formats from Instagram posts scraper
          if (item.url) return item.url;
          if (item.postUrl) return item.postUrl;
          if (item.shortCode) return `https://www.instagram.com/p/${item.shortCode}/`;
          return null;
        })
        .filter(url => url !== null)
        .slice(0, 10); // Limit to 10 posts for cost control

      if (postUrls.length === 0) {
        this.logger.warn(`No valid post URLs found for Instagram run ${scraperRun.id}`);
        return;
      }

      this.logger.log(`Found ${postUrls.length} Instagram post URLs, triggering comments scraper`);

      // Create configuration for comments scraper
      const commentsConfig = {
        startUrls: postUrls.map(url => ({ url, method: 'GET' })),
        maxComments: scraperRun.scraper_jobs.config?.max_comments_per_post || 20,
        maxReplies: 5, // Limit replies per comment
      };

      // Trigger the Instagram comments scraper
      const commentsRun = await this.apifyService.startScraperRun(
        'instagram_comments',
        commentsConfig,
        scraperRun.metadata?.webhook_url
      );

      // Create a new scraper run for the comments scraper
      const { data: newRun, error } = await this.supabaseService.adminClient
        .from('scraper_runs')
        .insert({
          job_id: scraperRun.job_id,
          tenant_id: scraperRun.scraper_jobs.tenant_id,
          status: 'running',
          apify_run_id: commentsRun.id,
          started_at: new Date().toISOString(),
          metadata: {
            is_comments_scraper: true,
            parent_posts_run_id: scraperRun.id,
            parent_apify_run_id: scraperRun.apify_run_id,
            post_urls: postUrls,
            triggered_automatically: true,
            webhook_url: scraperRun.metadata?.webhook_url,
          },
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create comments scraper run: ${error.message}`);
      }

      // Update the original posts run to indicate comments scraper was triggered
      await this.supabaseService.adminClient
        .from('scraper_runs')
        .update({
          metadata: {
            ...scraperRun.metadata,
            comments_scraper_triggered: true,
            comments_run_id: newRun.id,
            comments_apify_run_id: commentsRun.id,
            post_urls_found: postUrls.length,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', scraperRun.id);

      this.logger.log(`Successfully triggered Instagram comments scraper. Comments run ID: ${newRun.id}`);

    } catch (error) {
      this.logger.error(`Failed to handle Instagram posts completion: ${error.message}`, error.stack);
      
      // Update run with error
      await this.supabaseService.adminClient
        .from('scraper_runs')
        .update({
          metadata: {
            ...scraperRun.metadata,
            comments_scraper_error: error.message,
            comments_scraper_failed_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', scraperRun.id);
    }
  }
}