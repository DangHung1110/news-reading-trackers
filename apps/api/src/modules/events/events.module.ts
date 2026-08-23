import { Module } from '@nestjs/common';

import { ArticlesModule } from '../articles/articles.module';
import { SessionsModule } from '../sessions/sessions.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [ArticlesModule, SessionsModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
