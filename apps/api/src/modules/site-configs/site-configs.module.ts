import { Module } from '@nestjs/common';

import { SiteConfigsController } from './site-configs.controller';
import { SiteConfigsService } from './site-configs.service';

@Module({
  controllers: [SiteConfigsController],
  providers: [SiteConfigsService],
})
export class SiteConfigsModule {}
