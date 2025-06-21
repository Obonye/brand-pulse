import { Module } from '@nestjs/common';
import { SupabaseModule } from '../modules/shared/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  exports: [SupabaseModule],
})
export class SharedModule {}
