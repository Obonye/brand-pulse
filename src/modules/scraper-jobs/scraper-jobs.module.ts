import { Module } from '@nestjs/common';
import { ScraperJobsController } from './scraper-jobs.controller';
import { ScraperJobsService } from './scraper-jobs.service';
import { ApifyWebhookController } from './apify-webhook.controller';
import { SharedModule } from '../../shared/shared.module';
import { BrandsModule } from '../../brands/brands.module';
import { MentionsModule } from '../mentions/mentions.module';

@Module({
  imports: [SharedModule, BrandsModule, MentionsModule],
  controllers: [ScraperJobsController, ApifyWebhookController],
  providers: [ScraperJobsService],
  exports: [ScraperJobsService],
})
export class ScraperJobsModule {}