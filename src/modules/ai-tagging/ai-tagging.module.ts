import { Module } from '@nestjs/common';
import { AITaggingService } from './ai-tagging.service';
import { AITaggingController } from './ai-tagging.controller';
import { IndustryTagTemplatesService } from './industry-templates/industry-tag-templates.service';
import { SupabaseModule } from '../shared/supabase/supabase.module';
import { OpenAIModule } from '../shared/openai/openai.module';
import { LoggerService } from '../../common/logger/logger.service';

@Module({
  imports: [SupabaseModule, OpenAIModule],
  controllers: [AITaggingController],
  providers: [AITaggingService, IndustryTagTemplatesService, LoggerService],
  exports: [AITaggingService, IndustryTagTemplatesService],
})
export class AITaggingModule {}