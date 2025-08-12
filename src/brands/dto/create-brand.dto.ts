import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl, IsNotEmpty, IsArray, IsUUID } from 'class-validator';

export class CreateBrandDto {
  @ApiProperty({ 
    description: 'Brand name',
    example: 'Grand Palace Hotel'
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ 
    description: 'Brand description', 
    example: 'Luxury hotel in downtown Gaborone',
    required: false 
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ 
    description: 'Brand website URL', 
    example: 'https://grandpalacehotel.com',
    required: false 
  })
  @IsUrl()
  @IsOptional()
  website_url?: string;

  @ApiProperty({ 
    description: 'Brand logo URL', 
    example: 'https://example.com/logo.png',
    required: false 
  })
  @IsUrl()
  @IsOptional()
  logo_url?: string;

  @ApiProperty({ 
    description: 'Keywords for monitoring',
    example: ['hotel', 'luxury', 'gaborone', 'accommodation'],
    type: [String],
    required: false 
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  keywords?: string[];

  @ApiProperty({ 
    description: 'Competitor brand names to monitor',
    example: ['Hilton Gaborone', 'Marriott Hotel', 'Sun International'],
    type: [String],
    required: false 
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  competitor_brands?: string[];

  @ApiProperty({ 
    description: 'Geographic location', 
    example: 'Gaborone, Botswana',
    required: false 
  })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ 
    description: 'Industry ID for the brand',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false 
  })
  @IsUUID()
  @IsOptional()
  industry_id?: string;
}