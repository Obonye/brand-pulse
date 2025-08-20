import { IsString, IsArray, IsBoolean, IsEnum, IsOptional, IsEmail, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportType } from './generate-report.dto';

export class ScheduleReportDto {
  @ApiProperty({
    enum: ReportType,
    description: 'Type of report to schedule'
  })
  @IsEnum(ReportType)
  reportType: ReportType;

  @ApiProperty({
    description: 'Cron expression for scheduling (e.g., "0 8 * * MON" for Mondays at 8 AM)',
    example: '0 8 * * MON'
  })
  @IsString()
  @Matches(/^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/, {
    message: 'Invalid cron expression format'
  })
  scheduleCron: string;

  @ApiProperty({
    description: 'Email addresses to send the report to',
    type: [String],
    example: ['admin@company.com', 'manager@company.com']
  })
  @IsArray()
  @IsEmail({}, { each: true })
  emailRecipients: string[];

  @ApiPropertyOptional({
    description: 'Whether the scheduled report is active',
    default: true
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @ApiPropertyOptional({
    description: 'Array of brand IDs to include in scheduled reports',
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  brandIds?: string[];

  @ApiPropertyOptional({
    description: 'Array of source types to include in scheduled reports',
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sourceTypes?: string[];
}

export class UpdateScheduledReportDto {
  @ApiPropertyOptional({
    description: 'Cron expression for scheduling',
    example: '0 8 * * MON'
  })
  @IsOptional()
  @IsString()
  @Matches(/^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/, {
    message: 'Invalid cron expression format'
  })
  scheduleCron?: string;

  @ApiPropertyOptional({
    description: 'Email addresses to send the report to',
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  emailRecipients?: string[];

  @ApiPropertyOptional({
    description: 'Whether the scheduled report is active'
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Array of brand IDs to include in scheduled reports',
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  brandIds?: string[];

  @ApiPropertyOptional({
    description: 'Array of source types to include in scheduled reports',
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sourceTypes?: string[];
}

export class ScheduledReportResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty()
  scheduledReport: {
    id: string;
    tenant_id: string;
    report_type: string;
    schedule_cron: string;
    is_active: boolean;
    email_recipients: string[];
    next_scheduled_at: string;
    created_at: string;
  };
}