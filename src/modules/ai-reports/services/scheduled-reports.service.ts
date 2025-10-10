import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../shared/supabase/supabase.service';
import { ReportGeneratorService } from './report-generator.service';
import { ReportDataService } from './report-data.service';
import { 
  ScheduledReportEntity, 
  CreateScheduledReportData, 
  UpdateScheduledReportData,
  ScheduleFrequency 
} from '../entities/scheduled-report.entity';
import { 
  ScheduleReportDto, 
  UpdateScheduledReportDto 
} from '../dto/schedule-report.dto';
import { GenerateReportDto } from '../dto/generate-report.dto';

@Injectable()
export class ScheduledReportsService implements OnModuleInit {
  private readonly logger = new Logger(ScheduledReportsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly reportGenerator: ReportGeneratorService,
    private readonly reportDataService: ReportDataService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    const cronExpression = this.configService.get<string>('SCHEDULE_CHECK_CRON', '0 8,20 * * *');
    this.logger.log(`Scheduled reports will be checked using cron: ${cronExpression}`);
  }

  /**
   * Cron job to process scheduled reports twice daily (8 AM and 8 PM)
   * Can be configured via SCHEDULE_CHECK_CRON environment variable
   */
  @Cron('0 8,20 * * *') // 8 AM and 8 PM daily
  async processScheduledReports(): Promise<void> {
    try {
      this.logger.debug('Processing scheduled reports...');
      
      const dueReports = await this.getDueReports();
      this.logger.log(`Found ${dueReports.length} reports due for execution`);

      for (const scheduledReport of dueReports) {
        try {
          await this.executeScheduledReportInternal(scheduledReport);
        } catch (error) {
          this.logger.error(`Failed to execute scheduled report ${scheduledReport.id}`, {
            error: error.message,
            scheduledReportId: scheduledReport.id,
            tenantId: scheduledReport.tenant_id
          });
        }
      }

    } catch (error) {
      this.logger.error('Failed to process scheduled reports', {
        error: error.message
      });
    }
  }

  /**
   * Create a new scheduled report
   */
  async createScheduledReport(
    tenantId: string,
    scheduleDto: ScheduleReportDto,
    userId?: string
  ): Promise<ScheduledReportEntity> {
    try {
      this.logger.log(`Creating scheduled report`, {
        tenantId,
        reportType: scheduleDto.reportType,
        scheduleCron: scheduleDto.scheduleCron
      });

      // Validate cron expression
      if (!ScheduleFrequency.isValidCron(scheduleDto.scheduleCron)) {
        throw new BadRequestException('Invalid cron expression format');
      }

      // Calculate next execution time
      const nextScheduledAt = ScheduleFrequency.getNextExecution(scheduleDto.scheduleCron);

      const reportData: CreateScheduledReportData = {
        tenant_id: tenantId,
        report_type: scheduleDto.reportType,
        schedule_cron: scheduleDto.scheduleCron,
        is_active: scheduleDto.isActive !== false,
        email_recipients: scheduleDto.emailRecipients,
        report_config: {
          brandIds: scheduleDto.brandIds,
          sourceTypes: scheduleDto.sourceTypes,
          formats: ['pdf', 'html'], // Default formats
          minTagConfidence: 0.7,
          minTopicConfidence: 0.6
        },
        next_scheduled_at: nextScheduledAt.toISOString(),
        created_by: userId || null
      };

      const { data, error } = await this.supabaseService.adminClient
        .from('scheduled_reports')
        .insert([reportData])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create scheduled report: ${error.message}`);
      }

      this.logger.log(`Successfully created scheduled report`, {
        scheduledReportId: data.id,
        tenantId,
        nextExecution: nextScheduledAt.toISOString()
      });

      return data;

    } catch (error) {
      this.logger.error('Failed to create scheduled report', {
        error: error.message,
        tenantId,
        scheduleDto
      });
      throw error;
    }
  }

  /**
   * Get all scheduled reports for a tenant
   */
  async getScheduledReports(tenantId: string): Promise<ScheduledReportEntity[]> {
    try {
      const { data, error } = await this.supabaseService.adminClient
        .from('scheduled_reports')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch scheduled reports: ${error.message}`);
      }

      return data || [];

    } catch (error) {
      this.logger.error('Failed to fetch scheduled reports', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Get a specific scheduled report
   */
  async getScheduledReport(tenantId: string, scheduleId: string): Promise<ScheduledReportEntity> {
    try {
      const { data, error } = await this.supabaseService.adminClient
        .from('scheduled_reports')
        .select('*')
        .eq('id', scheduleId)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !data) {
        throw new NotFoundException('Scheduled report not found');
      }

      return data;

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Failed to fetch scheduled report', {
        error: error.message,
        tenantId,
        scheduleId
      });
      throw new Error(`Failed to fetch scheduled report: ${error.message}`);
    }
  }

  /**
   * Update a scheduled report
   */
  async updateScheduledReport(
    tenantId: string,
    scheduleId: string,
    updateDto: UpdateScheduledReportDto
  ): Promise<ScheduledReportEntity> {
    try {
      // Validate cron expression if provided
      if (updateDto.scheduleCron && !ScheduleFrequency.isValidCron(updateDto.scheduleCron)) {
        throw new BadRequestException('Invalid cron expression format');
      }

      const updateData: UpdateScheduledReportData = {
        updated_at: new Date().toISOString()
      };

      if (updateDto.scheduleCron) {
        updateData.schedule_cron = updateDto.scheduleCron;
        updateData.next_scheduled_at = ScheduleFrequency.getNextExecution(updateDto.scheduleCron).toISOString();
      }

      if (updateDto.isActive !== undefined) {
        updateData.is_active = updateDto.isActive;
      }

      if (updateDto.emailRecipients) {
        updateData.email_recipients = updateDto.emailRecipients;
      }

      if (updateDto.brandIds || updateDto.sourceTypes) {
        // Get current config first
        const current = await this.getScheduledReport(tenantId, scheduleId);
        updateData.report_config = {
          ...current.report_config,
          brandIds: updateDto.brandIds || current.report_config.brandIds,
          sourceTypes: updateDto.sourceTypes || current.report_config.sourceTypes
        };
      }

      const { data, error } = await this.supabaseService.adminClient
        .from('scheduled_reports')
        .update(updateData)
        .eq('id', scheduleId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error || !data) {
        throw new Error(`Failed to update scheduled report: ${error?.message || 'Report not found'}`);
      }

      this.logger.log(`Successfully updated scheduled report`, {
        scheduledReportId: scheduleId,
        tenantId,
        changes: updateData
      });

      return data;

    } catch (error) {
      this.logger.error('Failed to update scheduled report', {
        error: error.message,
        tenantId,
        scheduleId,
        updateDto
      });
      throw error;
    }
  }

  /**
   * Delete a scheduled report
   */
  async deleteScheduledReport(tenantId: string, scheduleId: string): Promise<boolean> {
    try {
      const { error } = await this.supabaseService.adminClient
        .from('scheduled_reports')
        .delete()
        .eq('id', scheduleId)
        .eq('tenant_id', tenantId);

      if (error) {
        throw new Error(`Failed to delete scheduled report: ${error.message}`);
      }

      this.logger.log(`Successfully deleted scheduled report`, {
        scheduledReportId: scheduleId,
        tenantId
      });

      return true;

    } catch (error) {
      this.logger.error('Failed to delete scheduled report', {
        error: error.message,
        tenantId,
        scheduleId
      });
      throw error;
    }
  }

  /**
   * Toggle active status of a scheduled report
   */
  async toggleScheduledReport(tenantId: string, scheduleId: string): Promise<ScheduledReportEntity> {
    try {
      const current = await this.getScheduledReport(tenantId, scheduleId);
      
      return await this.updateScheduledReport(tenantId, scheduleId, {
        isActive: !current.is_active
      });

    } catch (error) {
      this.logger.error('Failed to toggle scheduled report', {
        error: error.message,
        tenantId,
        scheduleId
      });
      throw error;
    }
  }

  /**
   * Manually execute a scheduled report
   */
  async executeScheduledReport(
    tenantId: string,
    scheduleId: string,
    userId?: string
  ): Promise<any> {
    try {
      const scheduledReport = await this.getScheduledReport(tenantId, scheduleId);
      
      this.logger.log(`Manually executing scheduled report`, {
        scheduledReportId: scheduleId,
        tenantId,
        userId
      });

      return await this.executeScheduledReportInternal(scheduledReport, true, userId);

    } catch (error) {
      this.logger.error('Failed to manually execute scheduled report', {
        error: error.message,
        tenantId,
        scheduleId
      });
      throw error;
    }
  }

  /**
   * Get reports that are due for execution
   */
  private async getDueReports(): Promise<ScheduledReportEntity[]> {
    const now = new Date().toISOString();
    
    const { data, error } = await this.supabaseService.adminClient
      .from('scheduled_reports')
      .select('*')
      .eq('is_active', true)
      .lte('next_scheduled_at', now);

    if (error) {
      throw new Error(`Failed to fetch due reports: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Internal method to execute a scheduled report
   */
  private async executeScheduledReportInternal(
    scheduledReport: ScheduledReportEntity,
    isManual: boolean = false,
    userId?: string
  ): Promise<any> {
    const startTime = Date.now();

    try {
      this.logger.log(`Executing scheduled report`, {
        scheduledReportId: scheduledReport.id,
        tenantId: scheduledReport.tenant_id,
        reportType: scheduledReport.report_type,
        isManual
      });

      // Validate tenant has sufficient data before generating
      const dateRange = this.reportDataService.getDateRangeForSchedule(scheduledReport.report_type);
      const validation = await this.reportDataService.validateTenantData(
        scheduledReport.tenant_id,
        {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          brandIds: scheduledReport.report_config.brandIds,
          sourceTypes: scheduledReport.report_config.sourceTypes
        }
      );

      if (!validation.isValid) {
        this.logger.warn(`Skipping scheduled report - insufficient data`, {
          scheduledReportId: scheduledReport.id,
          errors: validation.errors
        });
        await this.updateNextExecutionTime(scheduledReport.id, scheduledReport.schedule_cron);
        return null;
      }

      // Prepare report generation DTO
      const generateDto: GenerateReportDto = {
        reportType: scheduledReport.report_type as any,
        ...dateRange,
        brandIds: scheduledReport.report_config.brandIds,
        sourceTypes: scheduledReport.report_config.sourceTypes,
        customInstructions: scheduledReport.report_config.customInstructions,
        formats: scheduledReport.report_config.formats || ['pdf', 'html'],
        minTagConfidence: scheduledReport.report_config.minTagConfidence || 0.7,
        minTopicConfidence: scheduledReport.report_config.minTopicConfidence || 0.6
      };

      // Generate the report
      const report = await this.reportGenerator.generateReport(
        scheduledReport.tenant_id,
        generateDto,
        userId
      );

      // Update scheduled report with execution info
      await this.updateScheduledReportExecution(
        scheduledReport.id,
        report.id,
        'success',
        Date.now() - startTime
      );

      // Update next execution time if not manual
      if (!isManual) {
        await this.updateNextExecutionTime(scheduledReport.id, scheduledReport.schedule_cron);
      }

      // TODO: Send email notifications to recipients
      await this.sendEmailNotifications(scheduledReport, report);

      this.logger.log(`Successfully executed scheduled report`, {
        scheduledReportId: scheduledReport.id,
        generatedReportId: report.id,
        processingTime: Date.now() - startTime
      });

      return report;

    } catch (error) {
      this.logger.error(`Failed to execute scheduled report`, {
        error: error.message,
        scheduledReportId: scheduledReport.id,
        processingTime: Date.now() - startTime
      });

      // Update with failure status
      await this.updateScheduledReportExecution(
        scheduledReport.id,
        null,
        'failed',
        Date.now() - startTime,
        error.message
      );

      // Still update next execution time for automatic retries
      if (!isManual) {
        await this.updateNextExecutionTime(scheduledReport.id, scheduledReport.schedule_cron);
      }

      throw error;
    }
  }

  /**
   * Update scheduled report execution tracking
   */
  private async updateScheduledReportExecution(
    scheduleId: string,
    reportId: string | null,
    status: 'success' | 'failed',
    processingTime: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateData = {
        last_executed_at: new Date().toISOString(),
        last_generated_report_id: reportId,
        updated_at: new Date().toISOString()
      };

      const { error } = await this.supabaseService.adminClient
        .from('scheduled_reports')
        .update(updateData)
        .eq('id', scheduleId);

      if (error) {
        this.logger.error('Failed to update scheduled report execution', {
          error: error.message,
          scheduleId,
          status
        });
      }

    } catch (error) {
      this.logger.error('Error updating scheduled report execution', {
        error: error.message,
        scheduleId
      });
    }
  }

  /**
   * Update next execution time based on cron schedule
   */
  private async updateNextExecutionTime(scheduleId: string, cronExpression: string): Promise<void> {
    try {
      const nextExecution = ScheduleFrequency.getNextExecution(cronExpression);

      const { error } = await this.supabaseService.adminClient
        .from('scheduled_reports')
        .update({
          next_scheduled_at: nextExecution.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', scheduleId);

      if (error) {
        this.logger.error('Failed to update next execution time', {
          error: error.message,
          scheduleId,
          nextExecution: nextExecution.toISOString()
        });
      }

    } catch (error) {
      this.logger.error('Error updating next execution time', {
        error: error.message,
        scheduleId
      });
    }
  }

  /**
   * Send email notifications for completed report
   * This is a placeholder - implement with your email service
   */
  private async sendEmailNotifications(
    scheduledReport: ScheduledReportEntity,
    report: any
  ): Promise<void> {
    try {
      this.logger.log(`Sending email notifications`, {
        scheduledReportId: scheduledReport.id,
        recipients: scheduledReport.email_recipients.length,
        reportId: report.id
      });

      // TODO: Implement email sending logic
      // This could integrate with services like SendGrid, SES, etc.
      // For now, just log that emails would be sent

      for (const email of scheduledReport.email_recipients) {
        this.logger.debug(`Would send report to: ${email}`, {
          reportTitle: report.title,
          reportType: report.report_type
        });
      }

    } catch (error) {
      this.logger.error('Failed to send email notifications', {
        error: error.message,
        scheduledReportId: scheduledReport.id
      });
    }
  }

  /**
   * Get scheduled report statistics
   */
  async getScheduledReportStats(tenantId: string): Promise<{
    totalScheduled: number;
    activeSchedules: number;
    executionsToday: number;
    nextExecution: string | null;
    schedulesByType: Record<string, number>;
  }> {
    try {
      const { data, error } = await this.supabaseService.adminClient
        .from('scheduled_reports')
        .select('*')
        .eq('tenant_id', tenantId);

      if (error) {
        throw new Error(`Failed to fetch scheduled report stats: ${error.message}`);
      }

      const reports = data || [];
      const today = new Date().toDateString();
      
      const stats = {
        totalScheduled: reports.length,
        activeSchedules: reports.filter(r => r.is_active).length,
        executionsToday: reports.filter(r => 
          r.last_executed_at && new Date(r.last_executed_at).toDateString() === today
        ).length,
        nextExecution: null as string | null,
        schedulesByType: {} as Record<string, number>
      };

      // Find next execution
      const activeReports = reports.filter(r => r.is_active && r.next_scheduled_at);
      if (activeReports.length > 0) {
        const nextReport = activeReports.reduce((earliest, current) => 
          !earliest || current.next_scheduled_at < earliest.next_scheduled_at ? current : earliest
        );
        stats.nextExecution = nextReport.next_scheduled_at;
      }

      // Count by type
      for (const report of reports) {
        stats.schedulesByType[report.report_type] = (stats.schedulesByType[report.report_type] || 0) + 1;
      }

      return stats;

    } catch (error) {
      this.logger.error('Failed to fetch scheduled report stats', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }
}