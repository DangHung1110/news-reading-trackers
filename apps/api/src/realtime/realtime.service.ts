import { Injectable, type MessageEvent } from '@nestjs/common';
import { interval, map, merge, Observable, of, Subject } from 'rxjs';

import type { RealtimeEventName, RealtimeEventPayload } from '@news-tracker/contracts';

const HEARTBEAT_INTERVAL_MS = 15_000;

@Injectable()
export class RealtimeService {
  private readonly events = new Subject<MessageEvent>();

  stream(): Observable<MessageEvent> {
    const connected = of<MessageEvent>({ data: { occurredAt: new Date().toISOString() } });
    const heartbeat = interval(HEARTBEAT_INTERVAL_MS).pipe(
      map(() => ({ type: 'heartbeat', data: { occurredAt: new Date().toISOString() } })),
    );
    return merge(connected, this.events.asObservable(), heartbeat);
  }

  publish(type: RealtimeEventName, payload: RealtimeEventPayload): void {
    this.events.next({
      id: crypto.randomUUID(),
      type,
      data: payload,
      retry: 3_000,
    });
  }
}
