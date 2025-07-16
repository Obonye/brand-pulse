import { Module } from '@nestjs/common';
import { MentionsController } from './mentions.controller';
import { MentionsService } from './mentions.service';
import { SharedModule } from '../../shared/shared.module';
import { SentimentModule } from '../sentiment/sentiment.module';

@Module({
  imports: [SharedModule, SentimentModule],
  controllers: [MentionsController],
  providers: [MentionsService],
  exports: [MentionsService]
})
export class MentionsModule {}