import { Module } from '@nestjs/common';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';
import { SharedModule } from '../shared/shared.module';
import { LoggerService } from '../common/logger/logger.service';

@Module({
  imports: [SharedModule],
  controllers: [BrandsController],
  providers: [BrandsService, LoggerService],
  exports: [BrandsService]
})
export class BrandsModule {}
