import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Acme Corporation' })
  @IsString()
  companyName: string;

  @ApiProperty({ example: 'contact@acme.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+267 123 4567', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'hospitality' })
  @IsString()
  industry: string;

  @ApiProperty({ example: 'professional', enum: ['basic', 'professional', 'enterprise'] })
  @IsEnum(['basic', 'professional', 'enterprise'])
  subscriptionTier: string;

  @ApiProperty({ example: 'admin@acme.com' })
  @IsEmail()
  adminEmail: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  adminPassword: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  adminFirstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  adminLastName: string;
}