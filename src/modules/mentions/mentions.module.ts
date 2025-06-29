import { Module } from '@nestjs/common';
import { MentionsService } from './mentions.service';
import { SupabaseModule } from '../shared/supabase/supabase.module';
import { ApifyModule } from '../shared/apify/apify.module';
import { SentimentModule } from '../sentiment/sentiment.module';

@Module({
  imports: [SupabaseModule, ApifyModule, SentimentModule],
  providers: [MentionsService],
  exports: [MentionsService],
})
export class MentionsModule {}