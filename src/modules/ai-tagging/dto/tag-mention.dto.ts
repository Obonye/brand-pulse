import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsEnum, IsNumber, IsString, IsOptional, Min, Max } from 'class-validator';

export class TagMentionDto {
  @ApiProperty({ 
    description: 'ID of the mention to tag',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsUUID()
  mention_id: string;

  @ApiProperty({ 
    description: 'Category ID for the tag',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsUUID()
  category_id: string;

  @ApiProperty({ 
    description: 'Intent ID for the tag',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsUUID()
  intent_id: string;

  @ApiProperty({ 
    description: 'Priority level of the mention',
    enum: ['low', 'medium', 'high'],
    example: 'high'
  })
  @IsEnum(['low', 'medium', 'high'])
  priority: 'low' | 'medium' | 'high';

  @ApiProperty({ 
    description: 'Urgency score between 0 and 1',
    minimum: 0,
    maximum: 1,
    example: 0.85
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  urgency_score: number;

  @ApiProperty({ 
    description: 'Confidence score of the AI tagging between 0 and 1',
    minimum: 0,
    maximum: 1,
    example: 0.92
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @ApiProperty({ 
    description: 'AI model used for tagging',
    example: 'gpt-4'
  })
  @IsString()
  ai_model: string;

  @ApiProperty({ 
    description: 'AI provider used for tagging',
    example: 'openai',
    required: false
  })
  @IsOptional()
  @IsString()
  ai_provider?: string = 'openai';
}