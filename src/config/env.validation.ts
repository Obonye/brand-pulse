import { IsString, IsNotEmpty, IsOptional, IsNumberString, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  SUPABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  SUPABASE_ANON_KEY: string;

  @IsString()
  @IsNotEmpty()
  SUPABASE_SERVICE_ROLE_KEY: string;

  @IsNumberString()
  @IsOptional()
  PORT?: string = '3001';

  @IsString()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: string = 'development';

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN?: string = '24h';

  @IsString()
  @IsNotEmpty()
  APIFY_TOKEN: string;

  @IsString()
  @IsOptional()
  API_BASE_URL?: string;

  @IsNumberString()
  @IsOptional()
  APIFY_MAX_RETRIES?: string = '10';

  @IsNumberString()
  @IsOptional()
  APIFY_TIMEOUT_SECS?: string = '600';

  @IsNumberString()
  @IsOptional()
  APIFY_MIN_DELAY_MS?: string = '1000';

  @IsString()
  @IsNotEmpty()
  OPENAI_API_KEY: string;

  @IsString()
  @IsOptional()
  ALLOWED_ORIGINS?: string;
}