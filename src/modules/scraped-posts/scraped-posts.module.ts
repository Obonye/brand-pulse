import { Module } from '@nestjs/common';
import { ScrapedPostsService } from './scraped-posts.service';
import { ScrapedPostsController } from './scraped-posts.controller';
import { SupabaseModule } from '../shared/supabase/supabase.module';
import { LoggerService } from '../../common/logger/logger.service';

@Module({
  imports: [SupabaseModule],
  controllers: [ScrapedPostsController],
  providers: [ScrapedPostsService, LoggerService],
  exports: [ScrapedPostsService],
})
export class ScrapedPostsModule {}