import { PartialType } from '@nestjs/swagger';
import { CreateScraperJobDto } from './create-scraper-job.dto';

export class UpdateScraperJobDto extends PartialType(CreateScraperJobDto) {}
