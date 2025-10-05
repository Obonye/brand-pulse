import { Module } from '@nestjs/common';
import { ComplianceFilterService } from './compliance-filter.service';
import { LoggerService } from '../../../common/logger/logger.service';

@Module({
  providers: [ComplianceFilterService, LoggerService],
  exports: [ComplianceFilterService],
})
export class ComplianceModule {}