import { ApiProperty } from '@nestjs/swagger';

export class IndustryResponseDto {
  @ApiProperty({ 
    description: 'Unique identifier for the industry',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  id: string;

  @ApiProperty({ 
    description: 'Internal industry name',
    example: 'restaurant'
  })
  name: string;

  @ApiProperty({ 
    description: 'Display name for the industry',
    example: 'Restaurant & Food Service'
  })
  display_name: string;

  @ApiProperty({ 
    description: 'Industry description',
    example: 'Restaurants, cafes, food delivery, and dining establishments',
    required: false 
  })
  description?: string;

  @ApiProperty({ 
    description: 'Whether the industry is active',
    example: true
  })
  is_active: boolean;

  @ApiProperty({ 
    description: 'Creation timestamp',
    example: '2024-01-01T00:00:00Z'
  })
  created_at: string;

  @ApiProperty({ 
    description: 'Last update timestamp',
    example: '2024-01-01T00:00:00Z'
  })
  updated_at: string;
}