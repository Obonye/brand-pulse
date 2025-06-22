import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApifyService } from './apify.service';

@Module({
  imports: [ConfigModule],
  providers: [ApifyService],
  exports: [ApifyService],
})
export class ApifyModule {}