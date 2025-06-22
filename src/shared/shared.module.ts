import { Module } from '@nestjs/common';
import { SupabaseModule } from '../modules/shared/supabase/supabase.module';
import { ApifyModule } from '../modules/shared/apify/apify.module';

@Module({
  imports: [SupabaseModule, ApifyModule],
  exports: [SupabaseModule, ApifyModule],
})
export class SharedModule {}
