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
  
  @ApiTags('Brands')
  @ApiBearerAuth()
  @Controller('brands')
  @UseGuards(JwtAuthGuard, TenantGuard)
  export class BrandsController {
    constructor(private readonly brandsService: BrandsService) {}
  
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
      status: HttpStatus.FORBIDDEN,
      description: 'Insufficient permissions',
    })
    async create(
      @Body() createBrandDto: CreateBrandDto,
      @CurrentTenant() tenantId: string,
      @CurrentUser() user: any,
    ) {
      const brand = await this.brandsService.create(createBrandDto, tenantId);
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
      const brands = await this.brandsService.findAll(tenantId);
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