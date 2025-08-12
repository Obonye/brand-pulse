import { Module } from '@nestjs/common';
import { IndustriesService } from './industries.service';
import { IndustriesController } from './industries.controller';
import { SupabaseModule } from '../shared/supabase/supabase.module';
import { LoggerService } from '../../common/logger/logger.service';

@Module({
  imports: [SupabaseModule],
  controllers: [IndustriesController],
  providers: [IndustriesService, LoggerService],
  exports: [IndustriesService],
})
export class IndustriesModule {}