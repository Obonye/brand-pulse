import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseService } from '../modules/shared/supabase/supabase.service';
import { RegisterDto } from '../modules/auth/dto/register.dto';
import { LoginDto } from '../modules/auth/dto/login.dto';

@Injectable()  // This decorator tells NestJS: "You can inject this service anywhere"
export class AuthService {
  
  // NestJS automatically provides these services when AuthService is created
  constructor(
    private supabaseService: SupabaseService,  // Database access
    private jwtService: JwtService,             // JWT token handling
    private configService: ConfigService       // Environment variables
  ) {}

  // Register new tenant with admin user
  async register(registerDto: RegisterDto) {
    try {
      // Step 1: Generate tenant slug (URL-friendly name)
      const slug = this.generateSlug(registerDto.companyName);

      // Step 2: Create tenant in database
      const { data: tenant, error: tenantError } = await this.supabaseService.adminClient
        .from('tenants')
        .insert({
          name: registerDto.companyName,
          slug,
          email: registerDto.email,
          phone: registerDto.phone,
          industry: registerDto.industry,
          subscription_tier: registerDto.subscriptionTier
        })
        .select()
        .single();

      if (tenantError) {
        throw new BadRequestException(`Failed to create tenant: ${tenantError.message}`);
      }

      // Step 3: Create admin user in Supabase Auth
      const { data: authUser, error: authError } = await this.supabaseService.adminClient.auth.admin.createUser({
        email: registerDto.adminEmail,
        password: registerDto.adminPassword,
        email_confirm: true,
        user_metadata: {
          first_name: registerDto.adminFirstName,
          last_name: registerDto.adminLastName,
          tenant_id: tenant.id,
          role: 'owner'
        }
      });

      if (authError) {
        throw new BadRequestException(`Failed to create user: ${authError.message}`);
      }

      // Step 4: Create user record in our database
      const { data: dbUser, error: userError } = await this.supabaseService.adminClient
        .from('users')
        .insert({
          tenant_id: tenant.id,
          supabase_auth_id: authUser.user.id,
          email: registerDto.adminEmail,
          first_name: registerDto.adminFirstName,
          last_name: registerDto.adminLastName,
          role: 'owner'
        })
        .select()
        .single();

      if (userError) {
        throw new BadRequestException(`Failed to create user profile: ${userError.message}`);
      }

      // Step 5: Create tenant quotas
      const quotaLimits = this.getQuotaLimits(registerDto.subscriptionTier);
      await this.supabaseService.adminClient
        .from('tenant_quotas')
        .insert({
          tenant_id: tenant.id,
          daily_scrape_limit: quotaLimits.daily,
          monthly_mentions_limit: quotaLimits.monthly,
          concurrent_jobs_limit: quotaLimits.concurrent
        });

      // Step 6: Generate JWT token for immediate login
      const token = this.jwtService.sign({
        sub: authUser.user.id,
        email: authUser.user.email,
        tenantId: tenant.id,
        role: dbUser.role
      });

      // Return success response
      return {
        message: 'Registration successful',
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug
        },
        user: {
          id: dbUser.id,
          email: dbUser.email,
          role: dbUser.role
        },
        access_token: token
      };

    } catch (error) {
      // If anything goes wrong, throw a clear error
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Registration failed');
    }
  }

  // User login
  async login(loginDto: LoginDto) {
    try {
      // Step 1: Authenticate with Supabase
      const { data, error } = await this.supabaseService.client.auth.signInWithPassword({
        email: loginDto.email,
        password: loginDto.password
      });

      if (error) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Step 2: Get user's tenant context
      const { data: userData, error: userError } = await this.supabaseService.adminClient
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
        .eq('supabase_auth_id', data.user.id)
        .eq('is_active', true)
        .single();

      if (userError || !userData) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Step 3: Check if tenant subscription is active
      if (!userData.tenants.subscription_active) {
        throw new UnauthorizedException('Subscription inactive');
      }

      // Step 4: Generate JWT token
      const token = this.jwtService.sign({
        sub: data.user.id,
        email: data.user.email,
        tenantId: userData.tenant_id,
        role: userData.role
      });

      // Return user info and token
      return {
        user: {
          id: data.user.id,
          email: data.user.email,
          role: userData.role
        },
        tenant: userData.tenants,
        access_token: token
      };

    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Login failed');
    }
  }

  // Helper method to generate URL-friendly slug
  private generateSlug(companyName: string): string {
    return companyName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  // Helper method to get quota limits by subscription tier
  private getQuotaLimits(tier: string) {
    const limits = {
      basic: { daily: 5000, monthly: 50000, concurrent: 3 },
      professional: { daily: 15000, monthly: 150000, concurrent: 8 },
      enterprise: { daily: 50000, monthly: 500000, concurrent: 20 }
    };
    return limits[tier] || limits.basic;
  }

  async logout(user: any) {
    try {
      const { error } = await this.supabaseService.client.auth.signOut();
      
      if (error) {
        throw new BadRequestException('Logout failed');
      }

      return {
        message: 'Logout successful'
      };
    } catch (error) {
      throw new BadRequestException('Logout failed');
    }
  }

  async getSession(user: any) {
    try {
      const { data: userData, error } = await this.supabaseService.adminClient
        .from('users')
        .select(`
          id,
          email,
          first_name,
          last_name,
          role,
          is_active,
          created_at,
          tenants (
            id,
            name,
            slug,
            subscription_tier,
            subscription_active
          )
        `)
        .eq('supabase_auth_id', user.id)
        .eq('is_active', true)
        .single();

      if (error || !userData) {
        throw new UnauthorizedException('Session invalid');
      }

      return {
        user: {
          id: userData.id,
          email: userData.email,
          firstName: userData.first_name,
          lastName: userData.last_name,
          role: userData.role,
          createdAt: userData.created_at
        },
        tenant: userData.tenants,
        sessionValid: true
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Session validation failed');
    }
  }
}