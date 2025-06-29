import { Module } from '@nestjs/common';
import { SentimentService } from './sentiment.service';
import { SentimentController } from './sentiment.controller';
import { SupabaseModule } from '../shared/supabase/supabase.module';
import { OpenAIModule } from '../shared/openai/openai.module';

@Module({
  imports: [SupabaseModule, OpenAIModule],
  controllers: [SentimentController],
  providers: [SentimentService],
  exports: [SentimentService],
})
export class SentimentModule {}