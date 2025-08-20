/**
 * Scheduled Reports entity representing the scheduled_reports table
 */
export interface ScheduledReportEntity {
  id: string;
  tenant_id: string;
  report_type: string;
  schedule_cron: string;
  is_active: boolean;
  email_recipients: string[];
  report_config: {
    brandIds?: string[];
    sourceTypes?: string[];
    customInstructions?: string;
    formats?: string[];
    minTagConfidence?: number;
    minTopicConfidence?: number;
  };
  last_executed_at: string | null;
  last_generated_report_id: string | null;
  next_scheduled_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Scheduled Report creation data (for inserts)
 */
export interface CreateScheduledReportData {
  tenant_id: string;
  report_type: string;
  schedule_cron: string;
  is_active: boolean;
  email_recipients: string[];
  report_config: {
    brandIds?: string[];
    sourceTypes?: string[];
    customInstructions?: string;
    formats?: string[];
    minTagConfidence?: number;
    minTopicConfidence?: number;
  };
  next_scheduled_at: string;
  created_by?: string | null;
}

/**
 * Scheduled Report update data (for updates)
 */
export interface UpdateScheduledReportData {
  schedule_cron?: string;
  is_active?: boolean;
  email_recipients?: string[];
  report_config?: {
    brandIds?: string[];
    sourceTypes?: string[];
    customInstructions?: string;
    formats?: string[];
    minTagConfidence?: number;
    minTopicConfidence?: number;
  };
  next_scheduled_at?: string;
  updated_at?: string;
}

/**
 * Scheduled Report execution data (for tracking executions)
 */
export interface ScheduledReportExecution {
  scheduled_report_id: string;
  executed_at: string;
  generated_report_id?: string;
  status: 'success' | 'failed' | 'partial';
  error_message?: string;
  processing_time?: number;
  emails_sent?: number;
  execution_metadata?: {
    mentionsProcessed?: number;
    tokensUsed?: number;
    aiModel?: string;
    exportFormats?: string[];
    emailDeliveryStatus?: {
      sent: number;
      failed: number;
      errors?: string[];
    };
  };
}

/**
 * Scheduled Report query filters
 */
export interface ScheduledReportQueryFilters {
  tenant_id: string;
  report_type?: string;
  is_active?: boolean;
  created_by?: string;
  limit?: number;
  offset?: number;
  sort_by?: 'created_at' | 'next_scheduled_at' | 'last_executed_at' | 'report_type';
  sort_order?: 'asc' | 'desc';
}

/**
 * Schedule frequency helpers
 */
export class ScheduleFrequency {
  static readonly DAILY = '0 8 * * *';        // Every day at 8 AM
  static readonly WEEKLY = '0 8 * * 1';       // Every Monday at 8 AM
  static readonly MONTHLY = '0 8 1 * *';      // First day of month at 8 AM
  static readonly HOURLY = '0 * * * *';       // Every hour at minute 0
  
  /**
   * Parse cron expression to human readable format
   */
  static parseCron(cronExpression: string): string {
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) {
      return 'Invalid cron expression';
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    // Common patterns
    if (cronExpression === this.DAILY) return 'Daily at 8:00 AM';
    if (cronExpression === this.WEEKLY) return 'Weekly on Mondays at 8:00 AM';
    if (cronExpression === this.MONTHLY) return 'Monthly on the 1st at 8:00 AM';
    if (cronExpression === this.HOURLY) return 'Every hour';

    // Basic parsing for display
    let timeStr = '';
    if (hour !== '*' && minute !== '*') {
      const h = parseInt(hour);
      const m = parseInt(minute);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
      timeStr = `at ${displayHour}:${m.toString().padStart(2, '0')} ${ampm}`;
    }

    if (dayOfWeek !== '*') {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = days[parseInt(dayOfWeek)] || 'Unknown';
      return `Weekly on ${dayName}s ${timeStr}`;
    }

    if (dayOfMonth !== '*') {
      return `Monthly on the ${dayOfMonth} ${timeStr}`;
    }

    if (hour !== '*') {
      return `Daily ${timeStr}`;
    }

    return cronExpression;
  }

  /**
   * Calculate next execution time from cron expression
   */
  static getNextExecution(cronExpression: string): Date {
    // This is a simplified implementation
    // In production, you'd use a proper cron parser like node-cron or cron-parser
    const now = new Date();
    const parts = cronExpression.split(' ');
    
    if (parts.length !== 5) {
      throw new Error('Invalid cron expression');
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    
    // Simple daily calculation
    if (dayOfWeek === '*' && dayOfMonth === '*' && month === '*') {
      const nextRun = new Date(now);
      nextRun.setHours(parseInt(hour) || 0);
      nextRun.setMinutes(parseInt(minute) || 0);
      nextRun.setSeconds(0);
      nextRun.setMilliseconds(0);
      
      // If time has passed today, schedule for tomorrow
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      
      return nextRun;
    }

    // For more complex schedules, return tomorrow for now
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Validate cron expression format
   */
  static isValidCron(cronExpression: string): boolean {
    const cronRegex = /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/;
    return cronRegex.test(cronExpression);
  }
}