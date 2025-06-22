import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BrandsModule } from './brands/brands.module';
import { ScrapersModule } from './scrapers/scrapers.module';
import { TenantsModule } from './tenants/tenants.module';
import { SharedModule } from './shared/shared.module';
import { ScraperJobsModule } from './modules/scraper-jobs/scraper-jobs.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
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
    ScraperJobsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}