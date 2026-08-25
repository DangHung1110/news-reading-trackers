import { firstValueFrom, skip } from 'rxjs';

import { RealtimeService } from './realtime.service';

describe('RealtimeService', () => {
  it('publishes named events to connected clients', async () => {
    const service = new RealtimeService();
    const eventPromise = firstValueFrom(service.stream().pipe(skip(1)));

    service.publish('dashboard.updated', { occurredAt: '2026-08-25T00:00:00.000Z' });

    await expect(eventPromise).resolves.toMatchObject({
      type: 'dashboard.updated',
      data: { occurredAt: '2026-08-25T00:00:00.000Z' },
    });
  });
});
