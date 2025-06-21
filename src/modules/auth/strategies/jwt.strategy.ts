// src/modules/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../shared/supabase/supabase.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private supabaseService: SupabaseService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: any) {
    // Get user with tenant information
    const { data: userData, error } = await this.supabaseService.adminClient
      .from('users')
      .select(`
        *,
        tenants (
          id,
          name,
          slug,
          subscription_tier,
          subscription_active
        )
      `)
      .eq('supabase_auth_id', payload.sub)
      .eq('is_active', true)
      .single();

    if (error || !userData) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Return user context for request
    return {
      id: payload.sub,
      email: payload.email,
      tenantId: userData.tenant_id,
      role: userData.role,
      tenant: userData.tenants,
    };
  }
}