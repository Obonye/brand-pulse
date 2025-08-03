import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class LoggerService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  setContext(context: string) {
    return {
      error: (message: string, meta?: any) => 
        this.logger.error(message, { context, ...meta }),
      warn: (message: string, meta?: any) => 
        this.logger.warn(message, { context, ...meta }),
      info: (message: string, meta?: any) => 
        this.logger.info(message, { context, ...meta }),
      debug: (message: string, meta?: any) => 
        this.logger.debug(message, { context, ...meta }),
    };
  }
}