import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CreateEventsDto } from './dto/create-events.dto';
import { EventsService } from './events.service';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @ApiOperation({ summary: 'Validate and ingest a batch of reading events' })
  ingest(@Body() body: CreateEventsDto) {
    return this.eventsService.ingestBatch(body.events);
  }
}
