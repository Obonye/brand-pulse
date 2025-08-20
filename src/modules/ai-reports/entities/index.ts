// AI Reports entities
export * from './ai-report.entity';
export * from './scheduled-report.entity';

// Re-export common types for convenience
export type {
  AiReportEntity,
  CreateAiReportData,
  UpdateAiReportData,
  AiReportQueryFilters,
  ReportProcessingMetadata
} from './ai-report.entity';

export type {
  ScheduledReportEntity,
  CreateScheduledReportData,
  UpdateScheduledReportData,
  ScheduledReportExecution,
  ScheduledReportQueryFilters
} from './scheduled-report.entity';

export { 
  ReportType, 
  ReportStatus 
} from './ai-report.entity';

export { 
  ScheduleFrequency 
} from './scheduled-report.entity';