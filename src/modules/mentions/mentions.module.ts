import { Module } from '@nestjs/common';
import { MentionsController } from './mentions.controller';
import { MentionsService } from './mentions.service';
import { SharedModule } from '../../shared/shared.module';
import { SentimentModule } from '../sentiment/sentiment.module';
import { AITaggingModule } from '../ai-tagging/ai-tagging.module';
import { ComplianceModule } from '../shared/compliance/compliance.module';
import { LoggerService } from '../../common/logger/logger.service';

@Module({
  imports: [SharedModule, SentimentModule, AITaggingModule, ComplianceModule],
  controllers: [MentionsController],
  providers: [MentionsService, LoggerService],
  exports: [MentionsService]
})
export class MentionsModule {}