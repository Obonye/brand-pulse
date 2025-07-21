// src/modules/scraper-jobs/scraper-jobs.service.ts
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../shared/supabase/supabase.service';
import { ApifyService } from '../shared/apify/apify.service';
import { BrandsService } from '../../brands/brands.service';
import { CreateScraperJobDto } from './dto/create-scraper-job.dto';
import { UpdateScraperJobDto } from './dto/update-scraper-job.dto';
import { ScraperJob, ScraperRun } from './entities/scraper-job.entity';

import { Logger } from '@nestjs/common';

@Injectable()
export class ScraperJobsService {
  private readonly logger = new Logger(ScraperJobsService.name);

  constructor(
    private supabaseService: SupabaseService,
    private apifyService: ApifyService,
    private brandsService: BrandsService,
    private configService: ConfigService,
  ) {}

  async create(createScraperJobDto: CreateScraperJobDto, tenantId: string): Promise<ScraperJob> {
    try {
      // Verify brand belongs to tenant
      await this.brandsService.findOne(createScraperJobDto.brand_id, tenantId);

      // Check if job already exists for this source type
      const { data: existingJob } = await this.supabaseService.adminClient
        .from('scraper_jobs')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('brand_id', createScraperJobDto.brand_id)
        .eq('source_type', createScraperJobDto.source_type)
        .single();

      if (existingJob) {
        throw new BadRequestException(
          `Scraper job for ${createScraperJobDto.source_type} already exists for this brand`
        );
      }

      const { data, error } = await this.supabaseService.adminClient
        .from('scraper_jobs')
        .insert({
          tenant_id: tenantId,
          name: createScraperJobDto.name,
          brand_id: createScraperJobDto.brand_id,
          source_type: createScraperJobDto.source_type,
          config: createScraperJobDto.config,
          schedule_cron: createScraperJobDto.schedule_cron || '0 */6 * * *',
        })
        .select(`
          *,
          brands (
            id,
            name
          )
        `)
        .single();

      if (error) {
        throw new BadRequestException(`Failed to create scraper job: ${error.message}`);
      }

      return data;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to create scraper job');
    }
  }

  async findAll(tenantId: string, brandId?: string): Promise<ScraperJob[]> {
    try {
      let query = this.supabaseService.adminClient
        .from('scraper_jobs')
        .select(`
          *,
          brands (
            id,
            name
          )
        `)
        .eq('tenant_id', tenantId);

      if (brandId) {
        query = query.eq('brand_id', brandId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw new BadRequestException(`Failed to fetch scraper jobs: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      throw new BadRequestException('Failed to fetch scraper jobs');
    }
  }

  async findOne(id: string, tenantId: string): Promise<ScraperJob> {
    try {
      const { data, error } = await this.supabaseService.adminClient
        .from('scraper_jobs')
        .select(`
          *,
          brands (
            id,
            name
          )
        `)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !data) {
        throw new NotFoundException('Scraper job not found');
      }

      return data;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch scraper job');
    }
  }

  async update(id: string, updateScraperJobDto: UpdateScraperJobDto, tenantId: string): Promise<ScraperJob> {
    try {
      // Verify job exists and belongs to tenant
      await this.findOne(id, tenantId);

      const { data, error } = await this.supabaseService.adminClient
        .from('scraper_jobs')
        .update({
          name: updateScraperJobDto.name,
          source_type: updateScraperJobDto.source_type,
          config: updateScraperJobDto.config,
          schedule_cron: updateScraperJobDto.schedule_cron,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select(`
          *,
          brands (
            id,
            name
          )
        `)
        .single();

      if (error) {
        throw new BadRequestException(`Failed to update scraper job: ${error.message}`);
      }

      return data;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to update scraper job');
    }
  }

  async toggleActive(id: string, tenantId: string): Promise<ScraperJob> {
    try {
      const job = await this.findOne(id, tenantId);

      const { data, error } = await this.supabaseService.adminClient
        .from('scraper_jobs')
        .update({
          is_active: !job.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select(`
          *,
          brands (
            id,
            name
          )
        `)
        .single();

      if (error) {
        throw new BadRequestException(`Failed to toggle scraper job: ${error.message}`);
      }

      return data;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to toggle scraper job');
    }
  }

  async remove(id: string, tenantId: string): Promise<void> {
    try {
      // Verify job exists and belongs to tenant
      await this.findOne(id, tenantId);

      const { error } = await this.supabaseService.adminClient
        .from('scraper_jobs')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) {
        throw new BadRequestException(`Failed to delete scraper job: ${error.message}`);
      }
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete scraper job');
    }
  }

  async getJobRuns(jobId: string, tenantId: string, limit = 10): Promise<ScraperRun[]> {
    try {
      // Verify job belongs to tenant
      await this.findOne(jobId, tenantId);

      const { data, error } = await this.supabaseService.adminClient
        .from('scraper_runs')
        .select('*')
        .eq('job_id', jobId)
        .eq('tenant_id', tenantId)
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new BadRequestException(`Failed to fetch job runs: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch job runs');
    }
  }

  async triggerJob(id: string, tenantId: string): Promise<ScraperRun> {
    try {
      const job = await this.findOne(id, tenantId);

      if (!job.is_active) {
        throw new ForbiddenException('Cannot trigger inactive job');
      }

      // Generate webhook URL for this run
      const apiBaseUrl = this.configService.get<string>('API_BASE_URL') || 'http://localhost:3000';
      const webhookUrl = `${apiBaseUrl}/api/webhooks/apify`;

      // Create a new scraper run first to get the run ID
      const { data: scraperRun, error } = await this.supabaseService.adminClient
        .from('scraper_runs')
        .insert({
          job_id: id,
          tenant_id: tenantId,
          status: 'scheduled',
          metadata: { 
            triggered_manually: true,
            webhook_url: webhookUrl
          },
        })
        .select()
        .single();

      if (error) {
        throw new BadRequestException(`Failed to create scraper run: ${error.message}`);
      }

      try {
        // Start the Apify run
        const apifyRun = await this.apifyService.startScraperRun(
          job.source_type,
          job.config,
          webhookUrl
        );

        // Update scraper run with Apify details
        const { data: updatedRun, error: updateError } = await this.supabaseService.adminClient
          .from('scraper_runs')
          .update({
            status: 'running',
            apify_run_id: apifyRun.id,
            started_at: new Date().toISOString(),
            metadata: {
              ...scraperRun.metadata,
              apify_run_id: apifyRun.id,
              webhook_url: webhookUrl,
              apify_actor_id: apifyRun.actId,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', scraperRun.id)
          .select()
          .single();

        if (updateError) {
          // If update fails, try to abort the Apify run
          try {
            await this.apifyService.abortRun(apifyRun.id);
          } catch (abortError) {
            this.logger?.warn(`Failed to abort Apify run ${apifyRun.id}: ${abortError.message}`);
          }
          throw new BadRequestException(`Failed to update scraper run: ${updateError.message}`);
        }

        // Update job's next_run_at
        await this.supabaseService.adminClient
          .from('scraper_jobs')
          .update({
            next_run_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        return updatedRun;

      } catch (apifyError) {
        // If Apify run fails to start, update the scraper run status
        await this.supabaseService.adminClient
          .from('scraper_runs')
          .update({
            status: 'failed',
            error_message: `Failed to start Apify run: ${apifyError.message}`,
            finished_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', scraperRun.id);

        throw apifyError;
      }

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException('Failed to trigger scraper job');
    }
  }

  async getJobStats(tenantId: string) {
    try {
      // Get total jobs
      const { count: totalJobs, error: jobsError } = await this.supabaseService.adminClient
        .from('scraper_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      if (jobsError) {
        console.warn('Failed to fetch total jobs:', jobsError);
      }

      // Get active jobs
      const { count: activeJobs, error: activeError } = await this.supabaseService.adminClient
        .from('scraper_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      if (activeError) {
        console.warn('Failed to fetch active jobs:', activeError);
      }

      // Get recent runs (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { count: recentRuns, error: runsError } = await this.supabaseService.adminClient
        .from('scraper_runs')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('started_at', yesterday.toISOString());

      if (runsError) {
        console.warn('Failed to fetch recent runs:', runsError);
      }

      // Get failed runs (last 24 hours)
      const { count: failedRuns, error: failedError } = await this.supabaseService.adminClient
        .from('scraper_runs')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'failed')
        .gte('started_at', yesterday.toISOString());

      if (failedError) {
        console.warn('Failed to fetch failed runs:', failedError);
      }

      return {
        total_jobs: totalJobs || 0,
        active_jobs: activeJobs || 0,
        runs_last_24h: recentRuns || 0,
        failed_runs_last_24h: failedRuns || 0,
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch job statistics');
    }
  }
}