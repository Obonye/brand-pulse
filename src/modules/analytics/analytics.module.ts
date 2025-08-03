import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { SupabaseModule } from '../shared/supabase/supabase.module';
import { LoggerService } from '../../common/logger/logger.service';

@Module({
  imports: [SupabaseModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, LoggerService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}