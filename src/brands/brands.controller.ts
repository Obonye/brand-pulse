// ===================================
import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    HttpStatus,
    ParseUUIDPipe,
  } from '@nestjs/common';
  import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
  } from '@nestjs/swagger';
  import { BrandsService } from './brands.service';
  import { CreateBrandDto } from './dto/create-brand.dto';
  import { UpdateBrandDto } from './dto/update-brand.dto';
  import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
  import { TenantGuard } from '../modules/auth/guards/tenant.guard';
  import { RolesGuard, Roles } from '../modules/auth/guards/roles.guard';
  import { CurrentTenant } from '../modules/auth/decorators/current-tenant.decorator';
  import { CurrentUser } from '../modules/auth/decorators/current-user.decorator';
  import { LoggerService } from '../common/logger/logger.service';
  
  @ApiTags('Brands')
  @ApiBearerAuth()
  @Controller('brands')
  @UseGuards(JwtAuthGuard, TenantGuard)
  export class BrandsController {
    private logger: ReturnType<LoggerService['setContext']>;

    constructor(
      private readonly brandsService: BrandsService,
      private readonly loggerService: LoggerService,
    ) {
      this.logger = this.loggerService.setContext('BrandsController');
    }
  
    @Post()
    @UseGuards(RolesGuard)
    @Roles('owner', 'admin')
    @ApiOperation({ summary: 'Create new brand' })
    @ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Brand created successfully',
    })
    @ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Invalid brand data',
    })
    @ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Brand with this name already exists',
    })
    @ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Insufficient permissions',
    })
    async create(
      @Body() createBrandDto: CreateBrandDto,
      @CurrentTenant() tenantId: string,
      @CurrentUser() user: any,
    ) {
      this.logger.info('POST /brands - Create brand request', { 
        tenantId, 
        userId: user?.id, 
        brandName: createBrandDto.name 
      });

      const brand = await this.brandsService.create(createBrandDto, tenantId);
      
      this.logger.info('POST /brands - Brand created successfully', { 
        tenantId, 
        brandId: brand.id, 
        brandName: brand.name 
      });

      return {
        message: 'Brand created successfully',
        brand,
      };
    }
  
    @Get()
    @ApiOperation({ summary: 'Get all brands' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Brands retrieved successfully',
    })
    async findAll(@CurrentTenant() tenantId: string) {
      this.logger.debug('GET /brands - Fetch all brands request', { tenantId });

      const brands = await this.brandsService.findAll(tenantId);
      
      this.logger.debug('GET /brands - Brands fetched successfully', { 
        tenantId, 
        count: brands.length 
      });

      return {
        brands,
        total: brands.length,
      };
    }
  
    @Get('stats')
    @ApiOperation({ summary: 'Get brand statistics' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Brand statistics retrieved successfully',
    })
    async getStats(@CurrentTenant() tenantId: string) {
      const stats = await this.brandsService.getBrandStats(tenantId);
      return {
        stats,
      };
    }
  
    @Get('competitors')
    @ApiOperation({ summary: 'Get all unique competitor names' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Competitors retrieved successfully',
    })
    async getAllCompetitors(@CurrentTenant() tenantId: string) {
      const competitors = await this.brandsService.getAllCompetitors(tenantId);
      return {
        competitors,
        total: competitors.length,
      };
    }
  
    @Get('competitors/network')
    @ApiOperation({ summary: 'Get competitor relationship network' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Competitor network retrieved successfully',
    })
    async getCompetitorNetwork(@CurrentTenant() tenantId: string) {
      const network = await this.brandsService.getCompetitorNetwork(tenantId);
      return {
        network,
      };
    }
  
    @Get(':id/stats')
    @ApiParam({ name: 'id', description: 'Brand UUID' })
    @ApiOperation({ summary: 'Get stats for a specific brand' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Brand stats retrieved successfully',
    })
    @ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Brand not found',
    })
    async getBrandStats(
      @Param('id', ParseUUIDPipe) id: string,
      @CurrentTenant() tenantId: string,
    ) {
      const stats = await this.brandsService.getSingleBrandStats(id, tenantId);
      return {
        stats,
      };
    }

    @Get(':id')
    @ApiParam({ name: 'id', description: 'Brand UUID' })
    @ApiOperation({ summary: 'Get brand by ID' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Brand retrieved successfully',
    })
    @ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Brand not found',
    })
    async findOne(
      @Param('id', ParseUUIDPipe) id: string,
      @CurrentTenant() tenantId: string,
    ) {
      const brand = await this.brandsService.findOne(id, tenantId);
      return {
        brand,
      };
    }
  
    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles('owner', 'admin')
    @ApiParam({ name: 'id', description: 'Brand UUID' })
    @ApiOperation({ summary: 'Update brand' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Brand updated successfully',
    })
    @ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Brand not found',
    })
    @ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Brand with this name already exists',
    })
    @ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Insufficient permissions',
    })
    async update(
      @Param('id', ParseUUIDPipe) id: string,
      @Body() updateBrandDto: UpdateBrandDto,
      @CurrentTenant() tenantId: string,
    ) {
      const brand = await this.brandsService.update(id, updateBrandDto, tenantId);
      return {
        message: 'Brand updated successfully',
        brand,
      };
    }
  
    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles('owner', 'admin')
    @ApiParam({ name: 'id', description: 'Brand UUID' })
    @ApiOperation({ summary: 'Delete brand' })
    @ApiResponse({
      status: HttpStatus.OK,
      description: 'Brand deleted successfully',
    })
    @ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Brand not found',
    })
    @ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Insufficient permissions',
    })
    async remove(
      @Param('id', ParseUUIDPipe) id: string,
      @CurrentTenant() tenantId: string,
    ) {
      await this.brandsService.remove(id, tenantId);
      return {
        message: 'Brand deleted successfully',
      };
    }
  }