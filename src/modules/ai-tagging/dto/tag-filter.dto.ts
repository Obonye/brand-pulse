import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsArray, IsDateString, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class TagFilterDto {
  @ApiProperty({ 
    description: 'Filter by mention ID',
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsOptional()
  @IsUUID()
  mention_id?: string;

  @ApiProperty({ 
    description: 'Filter by category ID',
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @ApiProperty({ 
    description: 'Filter by intent ID',
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsOptional()
  @IsUUID()
  intent_id?: string;

  @ApiProperty({ 
    description: 'Filter by priority level',
    required: false,
    enum: ['low', 'medium', 'high'],
    example: 'high'
  })
  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';

  @ApiProperty({ 
    description: 'Filter by topics (comma-separated)',
    required: false,
    example: 'food_quality,service_speed'
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value ? value.split(',').map((t: string) => t.trim()) : [])
  topics?: string[];

  @ApiProperty({ 
    description: 'Start date for filtering (ISO string)',
    required: false,
    example: '2024-01-01'
  })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiProperty({ 
    description: 'End date for filtering (ISO string)',
    required: false,
    example: '2024-12-31'
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiProperty({ 
    description: 'Number of results to return',
    required: false,
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value) || 20)
  limit?: number = 20;

  @ApiProperty({ 
    description: 'Number of results to skip',
    required: false,
    minimum: 0,
    default: 0,
    example: 0
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseInt(value) || 0)
  offset?: number = 0;
}