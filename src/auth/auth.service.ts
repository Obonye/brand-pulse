import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseService } from '../modules/shared/supabase/supabase.service';
import { RegisterDto } from '../modules/auth/dto/register.dto';
import { LoginDto } from '../modules/auth/dto/login.dto';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()  // This decorator tells NestJS: "You can inject this service anywhere"
export class AuthService {
  private logger: ReturnType<LoggerService['setContext']>;
  
  // NestJS automatically provides these services when AuthService is created
  constructor(
    private supabaseService: SupabaseService,  // Database access
    private jwtService: JwtService,             // JWT token handling
    private configService: ConfigService,      // Environment variables
    private loggerService: LoggerService       // Logging service
  ) {
    this.logger = this.loggerService.setContext('AuthService');
  }

  // Register new tenant with admin user
  async register(registerDto: RegisterDto) {
    this.logger.info('Starting tenant registration', { 
      companyName: registerDto.companyName,
      adminEmail: registerDto.adminEmail,
      subscriptionTier: registerDto.subscriptionTier,
      industry: registerDto.industry 
    });

    try {
      // Step 1: Generate tenant slug (URL-friendly name)
      const slug = this.generateSlug(registerDto.companyName);
      this.logger.debug('Generated tenant slug', { slug, companyName: registerDto.companyName });

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
        this.logger.error('Failed to create tenant', { 
          error: tenantError.message, 
          companyName: registerDto.companyName,
          slug 
        });
        throw new BadRequestException(`Failed to create tenant: ${tenantError.message}`);
      }

      this.logger.info('Tenant created successfully', { 
        tenantId: tenant.id, 
        tenantName: tenant.name, 
        slug: tenant.slug 
      });

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
        this.logger.error('Failed to create Supabase auth user', { 
          error: authError.message, 
          email: registerDto.adminEmail,
          tenantId: tenant.id 
        });
        throw new BadRequestException(`Failed to create user: ${authError.message}`);
      }

      this.logger.info('Supabase auth user created', { 
        userId: authUser.user.id, 
        email: authUser.user.email,
        tenantId: tenant.id 
      });

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

      this.logger.info('Registration completed successfully', { 
        tenantId: tenant.id,
        userId: dbUser.id,
        userEmail: dbUser.email,
        subscriptionTier: registerDto.subscriptionTier 
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
      this.logger.error('Unexpected error during registration', { 
        error: error.message, 
        companyName: registerDto.companyName,
        adminEmail: registerDto.adminEmail 
      });
      throw new BadRequestException('Registration failed');
    }
  }

  // User login
  async login(loginDto: LoginDto) {
    this.logger.info('User login attempt', { email: loginDto.email });

    try {
      // Step 1: Authenticate with Supabase
      const { data, error } = await this.supabaseService.client.auth.signInWithPassword({
        email: loginDto.email,
        password: loginDto.password
      });

      if (error) {
        this.logger.warn('Authentication failed', { 
          email: loginDto.email, 
          error: error.message 
        });
        throw new UnauthorizedException('Invalid credentials');
      }

      this.logger.debug('Supabase authentication successful', { 
        userId: data.user.id, 
        email: data.user.email 
      });

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
        this.logger.warn('User lookup failed or user inactive', { 
          userId: data.user.id, 
          email: data.user.email,
          error: userError?.message 
        });
        throw new UnauthorizedException('User not found or inactive');
      }

      // Step 3: Check if tenant subscription is active
      if (!userData.tenants.subscription_active) {
        this.logger.warn('Login rejected - inactive subscription', { 
          userId: data.user.id, 
          tenantId: userData.tenant_id,
          tenantName: userData.tenants.name 
        });
        throw new UnauthorizedException('Subscription inactive');
      }

      // Step 4: Generate JWT token
      const token = this.jwtService.sign({
        sub: data.user.id,
        email: data.user.email,
        tenantId: userData.tenant_id,
        role: userData.role
      });

      this.logger.info('Login successful', { 
        userId: data.user.id, 
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
      this.logger.error('Unexpected error during login', { 
        error: error.message, 
        email: loginDto.email 
      });
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
    this.logger.info('User logout initiated', { 
      userId: user.id, 
      email: user.email 
    });

    try {
      const { error } = await this.supabaseService.client.auth.signOut();
      
      if (error) {
        this.logger.error('Supabase logout failed', { 
          error: error.message, 
          userId: user.id 
        });
        throw new BadRequestException('Logout failed');
      }

      this.logger.info('Logout successful', { 
        userId: user.id, 
        email: user.email 
      });

      return {
        message: 'Logout successful'
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Unexpected error during logout', { 
        error: error.message, 
        userId: user.id 
      });
      throw new BadRequestException('Logout failed');
    }
  }

  async getSession(user: any) {
    this.logger.debug('Session validation requested', { 
      userId: user.id, 
      email: user.email 
    });

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