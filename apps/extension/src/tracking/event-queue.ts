import type { EventBatchResponse, ReadingEventPayload } from '@news-tracker/contracts';

import { getApiUrl } from '../config/api';
import { isReadingEventPayload } from '../messages';

const EVENT_QUEUE_KEY = 'pendingReadingEvents';
const MAX_BATCH_SIZE = 100;

let queueLock: Promise<void> = Promise.resolve();
let activeFlush: Promise<void> | null = null;

export async function enqueueReadingEvent(event: ReadingEventPayload): Promise<void> {
  await mutateQueue((current) =>
    current.some(({ eventId }) => eventId === event.eventId) ? current : [...current, event],
  );
}

export function flushReadingEvents(): Promise<void> {
  if (activeFlush !== null) return activeFlush;
  activeFlush = flushLoop().finally(() => {
    activeFlush = null;
  });
  return activeFlush;
}

async function flushLoop(): Promise<void> {
  while (true) {
    const queued = (await readQueue()).sort(compareEvents).slice(0, MAX_BATCH_SIZE);
    if (queued.length === 0) return;

    const apiUrl = (await getApiUrl()).replace(/\/$/u, '');
    let response: Response;
    try {
      response = await fetch(`${apiUrl}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: queued }),
      });
    } catch {
      return;
    }
    if (!response.ok) return;

    const result: unknown = await response.json().catch(() => null);
    if (!isEventBatchResponse(result)) return;
    const completedIds = new Set([
      ...result.accepted,
      ...result.duplicated,
      ...result.rejected.flatMap(({ eventId }) => (eventId === null ? [] : [eventId])),
    ]);
    if (completedIds.size === 0) return;
    await mutateQueue((current) => current.filter(({ eventId }) => !completedIds.has(eventId)));
  }
}

function mutateQueue(
  update: (current: ReadingEventPayload[]) => ReadingEventPayload[],
): Promise<void> {
  const operation = queueLock.then(async () => {
    const current = await getStoredQueue();
    await chrome.storage.local.set({ [EVENT_QUEUE_KEY]: update(current) });
  });
  queueLock = operation.catch(() => undefined);
  return operation;
}

async function readQueue(): Promise<ReadingEventPayload[]> {
  await queueLock;
  return getStoredQueue();
}

async function getStoredQueue(): Promise<ReadingEventPayload[]> {
  const stored = await chrome.storage.local.get(EVENT_QUEUE_KEY);
  const value: unknown = stored[EVENT_QUEUE_KEY];
  return Array.isArray(value) ? value.filter(isReadingEventPayload) : [];
}

function compareEvents(left: ReadingEventPayload, right: ReadingEventPayload): number {
  if (left.sessionId === right.sessionId) return left.sequenceNumber - right.sequenceNumber;
  return left.occurredAt.localeCompare(right.occurredAt);
}

function isEventBatchResponse(value: unknown): value is EventBatchResponse {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'accepted' in value &&
    isStringArray(value.accepted) &&
    'duplicated' in value &&
    isStringArray(value.duplicated) &&
    'rejected' in value &&
    Array.isArray(value.rejected) &&
    value.rejected.every(
      (item: unknown) =>
        typeof item === 'object' &&
        item !== null &&
        'eventId' in item &&
        (item.eventId === null || typeof item.eventId === 'string'),
    )
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
