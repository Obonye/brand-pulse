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
import { SentimentModule } from './modules/sentiment/sentiment.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { HealthModule } from './health/health.module';

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
    
    // Feature modules
    AuthModule,
    BrandsModule,
    ScrapersModule,
    TenantsModule,
    SharedModule,
    ScraperJobsModule,
    SentimentModule,
    AnalyticsModule,
    HealthModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}