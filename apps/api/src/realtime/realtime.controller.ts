import { Controller, Sse, type MessageEvent } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Observable } from 'rxjs';

import { RealtimeService } from './realtime.service';

@ApiTags('realtime')
@Controller()
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  @Sse('stream')
  @ApiOperation({ summary: 'Stream article, session and reading-event updates' })
  @ApiProduces('text/event-stream')
  stream(): Observable<MessageEvent> {
    return this.realtimeService.stream();
  }
}
