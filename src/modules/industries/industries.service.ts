import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../shared/supabase/supabase.service';
import { Industry } from './entities/industry.entity';
import { LoggerService } from '../../common/logger/logger.service';

@Injectable()
export class IndustriesService {
  private logger: ReturnType<LoggerService['setContext']>;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly loggerService: LoggerService,
  ) {
    this.logger = this.loggerService.setContext('IndustriesService');
  }

  async findAll(): Promise<Industry[]> {
    try {
      const { data, error } = await this.supabaseService.adminClient
        .from('industries')
        .select('*')
        .eq('is_active', true)
        .order('display_name');

      if (error) {
        this.logger.error(`Failed to fetch industries: ${error.message}`);
        return [];
      }

      this.logger.debug('Industries fetched successfully', {
        count: data?.length || 0
      });

      return data || [];
    } catch (error) {
      this.logger.error(`Error fetching industries: ${error.message}`);
      return [];
    }
  }

  async findOne(id: string): Promise<Industry | null> {
    try {
      const { data, error } = await this.supabaseService.adminClient
        .from('industries')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .single();

      if (error) {
        this.logger.error(`Failed to fetch industry: ${error.message}`, { industryId: id });
        return null;
      }

      this.logger.debug('Industry fetched successfully', { industryId: id });

      return data;
    } catch (error) {
      this.logger.error(`Error fetching industry: ${error.message}`, { industryId: id });
      return null;
    }
  }

  async findByName(name: string): Promise<Industry | null> {
    try {
      const { data, error } = await this.supabaseService.adminClient
        .from('industries')
        .select('*')
        .eq('name', name)
        .eq('is_active', true)
        .single();

      if (error) {
        this.logger.error(`Failed to fetch industry by name: ${error.message}`, { industryName: name });
        return null;
      }

      this.logger.debug('Industry fetched by name successfully', { industryName: name });

      return data;
    } catch (error) {
      this.logger.error(`Error fetching industry by name: ${error.message}`, { industryName: name });
      return null;
    }
  }

  async getIndustryStats(): Promise<{
    total_industries: number;
    active_industries: number;
    top_industries: Array<{ name: string; display_name: string; brand_count: number }>;
  }> {
    try {
      // Get total and active industries
      const { data: industriesData, error: industriesError } = await this.supabaseService.adminClient
        .from('industries')
        .select('id, is_active');

      if (industriesError) {
        this.logger.error(`Failed to fetch industry stats: ${industriesError.message}`);
        return {
          total_industries: 0,
          active_industries: 0,
          top_industries: [],
        };
      }

      const totalIndustries = industriesData?.length || 0;
      const activeIndustries = industriesData?.filter(industry => industry.is_active).length || 0;

      // Get top industries by brand count
      const { data: topIndustriesData, error: topIndustriesError } = await this.supabaseService.adminClient
        .from('industries')
        .select(`
          id,
          name,
          display_name,
          brands(count)
        `)
        .eq('is_active', true);

      let topIndustries: Array<{ name: string; display_name: string; brand_count: number }> = [];

      if (!topIndustriesError && topIndustriesData) {
        topIndustries = topIndustriesData
          .map(industry => ({
            name: industry.name,
            display_name: industry.display_name,
            brand_count: industry.brands?.length || 0
          }))
          .sort((a, b) => b.brand_count - a.brand_count)
          .slice(0, 10);
      }

      this.logger.debug('Industry stats fetched successfully', {
        totalIndustries,
        activeIndustries,
        topIndustriesCount: topIndustries.length
      });

      return {
        total_industries: totalIndustries,
        active_industries: activeIndustries,
        top_industries: topIndustries,
      };
    } catch (error) {
      this.logger.error(`Error fetching industry stats: ${error.message}`);
      return {
        total_industries: 0,
        active_industries: 0,
        top_industries: [],
      };
    }
  }
}