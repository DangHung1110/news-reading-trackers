import 'fake-indexeddb/auto';

import type { ReadingEventPayload } from '@news-tracker/contracts';

import {
  clearEventOutbox,
  closeEventOutbox,
  enqueueReadingEvent,
  flushReadingEvents,
  getEventSyncStatus,
} from './event-queue';

const localStorageData: Record<string, unknown> = {};
const syncStorageData: Record<string, unknown> = { apiUrl: 'http://localhost:3000/api' };
let now = 1_000_000;

describe('IndexedDB event outbox', () => {
  beforeAll(() => {
    vi.stubGlobal('chrome', {
      storage: {
        local: createStorageArea(localStorageData),
        sync: createStorageArea(syncStorageData),
      },
    });
  });

  beforeEach(async () => {
    now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    await clearEventOutbox();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await closeEventOutbox();
    vi.unstubAllGlobals();
  });

  it('keeps events pending and applies retry delay while the API is offline', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    await enqueueReadingEvent(createEvent(0));

    await flushReadingEvents();
    expect((await getEventSyncStatus()).pendingCount).toBe(1);
    expect((await getEventSyncStatus()).lastError).toContain('offline');

    fetchMock.mockResolvedValue(acknowledgement({ accepted: ['event-0'] }));
    await flushReadingEvents();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    now += 1_000;
    await flushReadingEvents();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('removes a pending event after reconnect and accepted acknowledgement', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(acknowledgement({ accepted: ['event-0'] }));
    vi.stubGlobal('fetch', fetchMock);
    await enqueueReadingEvent(createEvent(0));

    await flushReadingEvents();
    now += 1_000;
    await flushReadingEvents();

    const status = await getEventSyncStatus();
    expect(status.pendingCount).toBe(0);
    expect(status.lastSuccessAt).not.toBeNull();
  });

  it('removes duplicate events only after the API identifies them', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(acknowledgement({ duplicated: ['event-0'] })));
    await enqueueReadingEvent(createEvent(0));
    await enqueueReadingEvent(createEvent(0));

    expect((await getEventSyncStatus()).pendingCount).toBe(1);
    await flushReadingEvents();
    expect((await getEventSyncStatus()).pendingCount).toBe(0);
  });

  it('retains rejected events for diagnostics instead of retrying or deleting them', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          acknowledgement({ rejected: [{ eventId: 'event-0', reasons: ['invalid payload'] }] }),
        ),
    );
    await enqueueReadingEvent(createEvent(0));

    await flushReadingEvents();
    const status = await getEventSyncStatus();
    expect(status.pendingCount).toBe(0);
    expect(status.rejectedCount).toBe(1);
  });

  it('persists pending events when the extension database connection restarts', async () => {
    await enqueueReadingEvent(createEvent(0));
    await closeEventOutbox();

    expect((await getEventSyncStatus()).pendingCount).toBe(1);
  });

  it('sends each session in sequence order even when events were stored out of order', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const body = JSON.parse(readRequestBody(init)) as { events: ReadingEventPayload[] };
      return Promise.resolve(
        acknowledgement({ accepted: body.events.map(({ eventId }) => eventId) }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    await enqueueReadingEvent(createEvent(2));
    await enqueueReadingEvent(createEvent(0));
    await enqueueReadingEvent(createEvent(1));

    await flushReadingEvents();
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(readRequestBody(request)) as { events: ReadingEventPayload[] };
    expect(body.events.map(({ sequenceNumber }) => sequenceNumber)).toEqual([0, 1, 2]);
  });
});

function createEvent(sequenceNumber: number): ReadingEventPayload {
  return {
    eventId: `event-${sequenceNumber}`,
    eventType: sequenceNumber === 0 ? 'PAGE_ENTER' : 'PAGE_HEARTBEAT',
    sessionId: 'session-1',
    sequenceNumber,
    occurredAt: new Date(sequenceNumber * 1000).toISOString(),
    url: 'https://vnexpress.net/article-1.html',
    domain: 'vnexpress.net',
    title: 'Test article',
    browserId: 'browser-1',
    tabId: 1,
    context: {},
  };
}

function acknowledgement(
  value: Partial<{
    accepted: string[];
    duplicated: string[];
    rejected: { eventId: string | null; reasons: string[] }[];
  }>,
): Response {
  return new Response(JSON.stringify({ accepted: [], duplicated: [], rejected: [], ...value }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createStorageArea(data: Record<string, unknown>) {
  return {
    get(key: string) {
      return Promise.resolve({ [key]: data[key] });
    },
    set(update: Record<string, unknown>) {
      Object.assign(data, update);
      return Promise.resolve();
    },
    remove(key: string) {
      delete data[key];
      return Promise.resolve();
    },
  };
}

function readRequestBody(init: RequestInit): string {
  if (typeof init.body !== 'string') throw new Error('Expected a JSON request body');
  return init.body;
}
