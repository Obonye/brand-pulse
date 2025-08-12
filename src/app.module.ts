import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateSync } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { EnvironmentVariables } from './config/env.validation';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BrandsModule } from './brands/brands.module';
import { ScrapersModule } from './scrapers/scrapers.module';
import { TenantsModule } from './tenants/tenants.module';
import { SharedModule } from './shared/shared.module';
import { ScraperJobsModule } from './modules/scraper-jobs/scraper-jobs.module';
import { ScrapedPostsModule } from './modules/scraped-posts/scraped-posts.module';
import { SentimentModule } from './modules/sentiment/sentiment.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { MentionsModule } from './modules/mentions/mentions.module';
import { IndustriesModule } from './modules/industries/industries.module';
import { AITaggingModule } from './modules/ai-tagging/ai-tagging.module';
import { LoggerModule } from './common/logger/logger.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: (config: Record<string, unknown>) => {
        const validatedConfig = plainToClass(EnvironmentVariables, config, {
          enableImplicitConversion: true,
        });
        const errors = validateSync(validatedConfig, {
          skipMissingProperties: false,
        });

        if (errors.length > 0) {
          throw new Error(errors.toString());
        }
        return validatedConfig;
      },
    }),
    
    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000, // 60 seconds
      limit: 10,   // 10 requests per minute
    }]),
    
    // Logging
    LoggerModule,
    
    // Feature modules
    AuthModule,
    BrandsModule,
    ScrapersModule,
    TenantsModule,
    SharedModule,
    ScraperJobsModule,
    ScrapedPostsModule,
    SentimentModule,
    AnalyticsModule,
    MentionsModule,
    IndustriesModule,
    AITaggingModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}