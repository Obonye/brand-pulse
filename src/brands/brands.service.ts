// 4. src/brands/brands.service.ts
// ===================================
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { SupabaseService } from '../modules/shared/supabase/supabase.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { Brand } from './entities/brand.entity';

@Injectable()
export class BrandsService {
  constructor(private supabaseService: SupabaseService) {}

  async create(createBrandDto: CreateBrandDto, tenantId: string): Promise<Brand> {
    try {
      // Check if brand name already exists for this tenant
      const { data: existingBrand } = await this.supabaseService.adminClient
        .from('brands')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('name', createBrandDto.name)
        .single();

      if (existingBrand) {
        throw new ConflictException('Brand with this name already exists');
      }

      // Validate competitor brand names - ensure they're not empty strings
      if (createBrandDto.competitor_brands) {
        createBrandDto.competitor_brands = createBrandDto.competitor_brands
          .filter(name => name && name.trim().length > 0)
          .map(name => name.trim());
      }

      const { data, error } = await this.supabaseService.adminClient
        .from('brands')
        .insert({
          tenant_id: tenantId,
          name: createBrandDto.name,
          description: createBrandDto.description || null,
          website_url: createBrandDto.website_url || null,
          logo_url: createBrandDto.logo_url || null,
          keywords: createBrandDto.keywords || [],
          competitor_brands: createBrandDto.competitor_brands || [],
          location: createBrandDto.location || null,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        throw new BadRequestException(`Failed to create brand: ${error.message}`);
      }

      return data;
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
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
      const existingBrand = await this.findOne(id, tenantId);

      // Check if new name conflicts with existing brand (if name is being changed)
      if (updateBrandDto.name && updateBrandDto.name !== existingBrand.name) {
        const { data: nameConflict } = await this.supabaseService.adminClient
          .from('brands')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('name', updateBrandDto.name)
          .neq('id', id)
          .single();

        if (nameConflict) {
          throw new ConflictException('Brand with this name already exists');
        }
      }

      // Validate competitor brand names if provided
      if (updateBrandDto.competitor_brands) {
        // Remove empty strings and the brand's own name
        updateBrandDto.competitor_brands = updateBrandDto.competitor_brands
          .filter(name => name && name.trim().length > 0)
          .map(name => name.trim())
          .filter(name => name.toLowerCase() !== (updateBrandDto.name || existingBrand.name).toLowerCase());
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // Only include fields that are provided
      if (updateBrandDto.name !== undefined) updateData.name = updateBrandDto.name;
      if (updateBrandDto.description !== undefined) updateData.description = updateBrandDto.description || null;
      if (updateBrandDto.website_url !== undefined) updateData.website_url = updateBrandDto.website_url || null;
      if (updateBrandDto.logo_url !== undefined) updateData.logo_url = updateBrandDto.logo_url || null;
      if (updateBrandDto.keywords !== undefined) updateData.keywords = updateBrandDto.keywords || [];
      if (updateBrandDto.competitor_brands !== undefined) updateData.competitor_brands = updateBrandDto.competitor_brands || [];
      if (updateBrandDto.location !== undefined) updateData.location = updateBrandDto.location || null;

      const { data, error } = await this.supabaseService.adminClient
        .from('brands')
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        throw new BadRequestException(`Failed to update brand: ${error.message}`);
      }

      return data;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ConflictException) {
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
        .select('id, name, keywords, competitor_brands')
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

      // Calculate total keywords across all brands
      const totalKeywords = brands?.reduce((sum, brand) => sum + (brand.keywords?.length || 0), 0) || 0;

      // Calculate unique competitor brands mentioned
      const allCompetitors = new Set<string>();
      brands?.forEach(brand => {
        brand.competitor_brands?.forEach(comp => allCompetitors.add(comp));
      });

      return {
        total_brands: brands?.length || 0,
        active_scraper_jobs: scraperJobs || 0,
        mentions_last_30_days: recentMentions || 0,
        total_keywords: totalKeywords,
        unique_competitors: allCompetitors.size,
        brands_with_keywords: brands?.filter(b => b.keywords && b.keywords.length > 0).length || 0,
        brands_with_competitors: brands?.filter(b => b.competitor_brands && b.competitor_brands.length > 0).length || 0,
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch brand statistics');
    }
  }

  // Get all unique competitor names across all brands
  async getAllCompetitors(tenantId: string): Promise<string[]> {
    try {
      const { data: brands, error } = await this.supabaseService.adminClient
        .from('brands')
        .select('name, competitor_brands')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      if (error) {
        throw new BadRequestException('Failed to fetch brands');
      }

      // Collect all unique competitor names
      const competitors = new Set<string>();
      const ownBrandNames = new Set(brands?.map(b => b.name.toLowerCase()) || []);

      brands?.forEach(brand => {
        brand.competitor_brands?.forEach(comp => {
          // Add competitor if it's not one of our own brands
          if (!ownBrandNames.has(comp.toLowerCase())) {
            competitors.add(comp);
          }
        });
      });

      return Array.from(competitors).sort();
    } catch (error) {
      throw new BadRequestException('Failed to fetch competitors');
    }
  }

  // Get competitor relationships for visualization
  async getCompetitorNetwork(tenantId: string) {
    try {
      const { data: brands, error } = await this.supabaseService.adminClient
        .from('brands')
        .select('id, name, competitor_brands')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      if (error) {
        throw new BadRequestException('Failed to fetch competitor data');
      }

      // Build a network structure including external competitors
      const nodes: any[] = [];
      const edges: any[] = [];
      const nodeMap = new Map<string, any>();

      // Add our brands as nodes
      brands?.forEach(brand => {
        const node = {
          id: brand.id,
          name: brand.name,
          type: 'owned',
          isInternal: true
        };
        nodes.push(node);
        nodeMap.set(brand.name.toLowerCase(), node);
      });

      // Add competitor brands as nodes and create edges
      brands?.forEach(brand => {
        brand.competitor_brands?.forEach(competitorName => {
          const competitorKey = competitorName.toLowerCase();
          
          // Add competitor node if not already added
          if (!nodeMap.has(competitorKey)) {
            const competitorNode = {
              id: `competitor-${competitorName.replace(/\s+/g, '-').toLowerCase()}`,
              name: competitorName,
              type: 'competitor',
              isInternal: false
            };
            nodes.push(competitorNode);
            nodeMap.set(competitorKey, competitorNode);
          }

          // Create edge
          edges.push({
            source: brand.id,
            target: nodeMap.get(competitorKey).id,
            sourceName: brand.name,
            targetName: competitorName,
            relationship: 'monitors'
          });
        });
      });

      return {
        nodes,
        edges,
        summary: {
          total_nodes: nodes.length,
          owned_brands: nodes.filter(n => n.type === 'owned').length,
          competitor_brands: nodes.filter(n => n.type === 'competitor').length,
          total_relationships: edges.length
        }
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch competitor network');
    }
  }
}