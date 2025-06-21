import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../modules/shared/supabase/supabase.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { Brand } from './entities/brand.entity';

@Injectable()
export class BrandsService {
  constructor(private supabaseService: SupabaseService) {}

  async create(createBrandDto: CreateBrandDto, tenantId: string): Promise<Brand> {
    try {
      const { data, error } = await this.supabaseService.adminClient
        .from('brands')
        .insert({
          tenant_id: tenantId,
          name: createBrandDto.name,
          description: createBrandDto.description,
          website: createBrandDto.website,
          logo_url: createBrandDto.logoUrl,
        })
        .select()
        .single();

      if (error) {
        throw new BadRequestException(`Failed to create brand: ${error.message}`);
      }

      return data;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create brand');
    }
  }

  async findAll(tenantId: string): Promise<Brand[]> {
    try {
      const { data, error } = await this.supabaseService.adminClient
        .from('brands')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw new BadRequestException(`Failed to fetch brands: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      throw new BadRequestException('Failed to fetch brands');
    }
  }

  async findOne(id: string, tenantId: string): Promise<Brand> {
    try {
      const { data, error } = await this.supabaseService.adminClient
        .from('brands')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        throw new NotFoundException('Brand not found');
      }

      return data;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch brand');
    }
  }

  async update(id: string, updateBrandDto: UpdateBrandDto, tenantId: string): Promise<Brand> {
    try {
      // First check if brand exists and belongs to tenant
      await this.findOne(id, tenantId);

      const { data, error } = await this.supabaseService.adminClient
        .from('brands')
        .update({
          name: updateBrandDto.name,
          description: updateBrandDto.description,
          website: updateBrandDto.website,
          logo_url: updateBrandDto.logoUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        throw new BadRequestException(`Failed to update brand: ${error.message}`);
      }

      return data;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to update brand');
    }
  }

  async remove(id: string, tenantId: string): Promise<void> {
    try {
      // First check if brand exists and belongs to tenant
      await this.findOne(id, tenantId);

      // Soft delete - set is_active to false
      const { error } = await this.supabaseService.adminClient
        .from('brands')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) {
        throw new BadRequestException(`Failed to delete brand: ${error.message}`);
      }
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete brand');
    }
  }

  async getBrandStats(tenantId: string) {
    try {
      const { data: brands, error: brandsError } = await this.supabaseService.adminClient
        .from('brands')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      if (brandsError) {
        throw new BadRequestException(`Failed to fetch brand stats: ${brandsError.message}`);
      }

      // Get scraper jobs count
      const { count: scraperJobs, error: jobsError } = await this.supabaseService.adminClient
        .from('scraper_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      if (jobsError) {
        console.warn('Failed to fetch scraper jobs count:', jobsError);
      }

      // Get recent mentions count (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: recentMentions, error: mentionsError } = await this.supabaseService.adminClient
        .from('scraped_mentions')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('scraped_at', thirtyDaysAgo.toISOString());

      if (mentionsError) {
        console.warn('Failed to fetch mentions count:', mentionsError);
      }

      return {
        total_brands: brands?.length || 0,
        active_scraper_jobs: scraperJobs || 0,
        mentions_last_30_days: recentMentions || 0,
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch brand statistics');
    }
  }
}