import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

// Controllers
import { AiReportsController } from './ai-reports.controller';

// Services
import { ReportGeneratorService } from './services/report-generator.service';
import { ReportDataService } from './services/report-data.service';
import { OpenAIReportService } from './services/openai-report.service';
import { ReportExportService } from './services/report-export.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { ScheduledReportsService } from './services/scheduled-reports.service';

// Shared modules
import { SupabaseModule } from '../shared/supabase/supabase.module';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    SupabaseModule,
  ],
  controllers: [
    AiReportsController,
  ],
  providers: [
    // Core report generation services
    ReportGeneratorService,
    ReportDataService,
    OpenAIReportService,
    
    // Export and scheduling services
    ReportExportService,
    PdfGeneratorService,
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