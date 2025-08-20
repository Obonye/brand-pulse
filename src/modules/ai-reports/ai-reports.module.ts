import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

// Controllers
import { AiReportsController } from './ai-reports.controller';

// Services
import { ReportGeneratorService } from './services/report-generator.service';
import { ReportDataService } from './services/report-data.service';
import { OpenAIReportService } from './services/openai-report.service';
import { TemplateEngineService } from './services/template-engine.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { ReportExportService } from './services/report-export.service';
import { ScheduledReportsService } from './services/scheduled-reports.service';

// Shared modules
import { SupabaseModule } from '../shared/supabase/supabase.module';
import { LoggerModule } from '../shared/logger/logger.module';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    SupabaseModule,
    LoggerModule,
  ],
  controllers: [
    AiReportsController,
  ],
  providers: [
    // Core report generation services
    ReportGeneratorService,
    ReportDataService,
    OpenAIReportService,
    
    // Template and export services
    TemplateEngineService,
    PdfGeneratorService,
    ReportExportService,
    
    // Scheduling service
    ScheduledReportsService,
  ],
  exports: [
    // Export main services for use in other modules
    ReportGeneratorService,
    ReportDataService,
    OpenAIReportService,
    ScheduledReportsService,
  ],
})
export class AiReportsModule {
  constructor() {
    // Module initialization logging
    console.log('AI Reports Module initialized');
  }
}