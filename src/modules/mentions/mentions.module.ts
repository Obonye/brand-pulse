import { Module } from '@nestjs/common';
import { MentionsService } from './mentions.service';
import { SupabaseModule } from '../shared/supabase/supabase.module';
import { ApifyModule } from '../shared/apify/apify.module';

@Module({
  imports: [SupabaseModule, ApifyModule],
  providers: [MentionsService],
  exports: [MentionsService],
})
export class MentionsModule {}