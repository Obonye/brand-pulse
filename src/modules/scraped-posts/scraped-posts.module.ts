import { Module } from '@nestjs/common';
import { ScrapedPostsService } from './scraped-posts.service';
import { ScrapedPostsController } from './scraped-posts.controller';
import { SupabaseModule } from '../shared/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [ScrapedPostsController],
  providers: [ScrapedPostsService],
  exports: [ScrapedPostsService],
})
export class ScrapedPostsModule {}