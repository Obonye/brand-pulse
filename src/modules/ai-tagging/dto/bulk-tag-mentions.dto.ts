import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, IsOptional, IsString } from 'class-validator';

export class BulkTagMentionsDto {
  @ApiProperty({ 
    description: 'Array of mention IDs to process for AI tagging',
    example: ['550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001'],
    type: [String]
  })
  @IsArray()
  @IsUUID(4, { each: true })
  mention_ids: string[];

  @ApiProperty({ 
    description: 'Optional brand ID to filter industry context',
    required: false,
    example: '770e8400-e29b-41d4-a716-446655440002'
  })
  @IsOptional()
  @IsUUID()
  brand_id?: string;

  @ApiProperty({ 
    description: 'Optional industry ID to override brand industry context',
    required: false,
    example: '880e8400-e29b-41d4-a716-446655440003'
  })
  @IsOptional()
  @IsUUID()
  industry_id?: string;

  @ApiProperty({ 
    description: 'Force re-tagging of already tagged mentions',
    required: false,
    default: false,
    example: false
  })
  @IsOptional()
  force_retag?: boolean = false;
}