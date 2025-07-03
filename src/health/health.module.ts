import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { SupabaseModule } from '../modules/shared/supabase/supabase.module';
import { OpenaiModule } from '../modules/shared/openai/openai.module';
import { ApifyModule } from '../modules/shared/apify/apify.module';

@Module({
  imports: [
    TerminusModule,
    SupabaseModule,
    OpenaiModule,
    ApifyModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}