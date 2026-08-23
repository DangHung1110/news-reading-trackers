import type { EventBatchResponse, ReadingEventPayload } from '@news-tracker/contracts';

import { getApiUrl } from '../config/api';
import { isReadingEventPayload, type EventSyncStatus } from '../messages';

const DATABASE_NAME = 'newsReadingTracker';
const DATABASE_VERSION = 1;
const EVENT_STORE = 'events';
const LEGACY_QUEUE_KEY = 'pendingReadingEvents';
const SYNC_METADATA_KEY = 'eventSyncMetadata';
const BATCH_SIZE = 25;
const RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000, 60_000] as const;

type OutboxStatus = 'PENDING' | 'REJECTED';

interface OutboxEvent {
  eventId: string;
  sessionId: string;
  sequenceNumber: number;
  event: ReadingEventPayload;
  status: OutboxStatus;
  retryCount: number;
  nextRetryAt: number;
  createdAt: number;
  lastError: string | null;
}

interface SyncMetadata {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

let databasePromise: Promise<IDBDatabase> | null = null;
let activeFlush: Promise<void> | null = null;

export async function enqueueReadingEvent(event: ReadingEventPayload): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(EVENT_STORE, 'readwrite');
  const completion = transactionComplete(transaction);
  const store = transaction.objectStore(EVENT_STORE);
  const existing = await requestResult(
    store.get(event.eventId) as IDBRequest<OutboxEvent | undefined>,
  );
  if (existing === undefined) {
    store.add({
      eventId: event.eventId,
      sessionId: event.sessionId,
      sequenceNumber: event.sequenceNumber,
      event,
      status: 'PENDING',
      retryCount: 0,
      nextRetryAt: Date.now(),
      createdAt: Date.now(),
      lastError: null,
    } satisfies OutboxEvent);
  }
  await completion;
}

export function flushReadingEvents(): Promise<void> {
  if (activeFlush !== null) return activeFlush;
  activeFlush = flushLoop().finally(() => {
    activeFlush = null;
  });
  return activeFlush;
}

export async function getEventSyncStatus(): Promise<EventSyncStatus> {
  const [events, metadata] = await Promise.all([getAllEvents(), getSyncMetadata()]);
  return {
    pendingCount: events.filter(({ status }) => status === 'PENDING').length,
    rejectedCount: events.filter(({ status }) => status === 'REJECTED').length,
    ...metadata,
  };
}

export async function getNextRetryAt(): Promise<number | null> {
  const pending = (await getAllEvents()).filter(({ status }) => status === 'PENDING');
  if (pending.length === 0) return null;
  return Math.min(...pending.map(({ nextRetryAt }) => nextRetryAt));
}

export async function migrateLegacyEventQueue(): Promise<void> {
  const stored = await chrome.storage.local.get(LEGACY_QUEUE_KEY);
  const legacyEvents: unknown = stored[LEGACY_QUEUE_KEY];
  if (!Array.isArray(legacyEvents)) return;

  for (const event of legacyEvents.filter(isReadingEventPayload)) {
    await enqueueReadingEvent(event);
  }
  await chrome.storage.local.remove(LEGACY_QUEUE_KEY);
}

export async function clearEventOutbox(): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(EVENT_STORE, 'readwrite');
  const completion = transactionComplete(transaction);
  transaction.objectStore(EVENT_STORE).clear();
  await completion;
  await chrome.storage.local.remove(SYNC_METADATA_KEY);
}

export async function closeEventOutbox(): Promise<void> {
  if (databasePromise === null) return;
  const currentDatabase = databasePromise;
  databasePromise = null;
  (await currentDatabase).close();
}

async function flushLoop(): Promise<void> {
  while (true) {
    const batch = await getDueEvents(Date.now());
    if (batch.length === 0) return;

    const attemptedAt = new Date().toISOString();
    await updateSyncMetadata({ lastAttemptAt: attemptedAt });
    let response: Response;
    try {
      const apiUrl = (await getApiUrl()).replace(/\/$/u, '');
      response = await fetch(`${apiUrl}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch.map(({ event }) => event) }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      await handleTemporaryFailure(batch, 'API is offline or unreachable');
      return;
    }

    if (!response.ok) {
      await handleTemporaryFailure(batch, `API returned HTTP ${response.status}`);
      return;
    }
    const result: unknown = await response.json().catch(() => null);
    if (!isEventBatchResponse(result)) {
      await handleTemporaryFailure(batch, 'API returned an invalid acknowledgement');
      return;
    }

    const unacknowledgedCount = await applyAcknowledgement(batch, result);
    const rejectedCount = result.rejected.filter(({ eventId }) => eventId !== null).length;
    await updateSyncMetadata({
      lastSuccessAt: new Date().toISOString(),
      lastError:
        rejectedCount > 0
          ? `${rejectedCount} event(s) rejected by API`
          : unacknowledgedCount > 0
            ? `${unacknowledgedCount} event(s) were not acknowledged`
            : null,
    });
  }
}

async function getDueEvents(now: number): Promise<OutboxEvent[]> {
  const pending = (await getAllEvents())
    .filter(({ status }) => status === 'PENDING')
    .sort(compareEvents);
  const blockedSessions = new Set<string>();
  const due: OutboxEvent[] = [];

  for (const record of pending) {
    if (record.nextRetryAt > now) {
      blockedSessions.add(record.sessionId);
      continue;
    }
    if (blockedSessions.has(record.sessionId)) continue;
    due.push(record);
    if (due.length === BATCH_SIZE) break;
  }
  return due;
}

async function handleTemporaryFailure(batch: OutboxEvent[], message: string): Promise<void> {
  await updateOutboxRecords(
    batch.map((record) => retryRecord(record, message)),
    [],
  );
  await updateSyncMetadata({ lastError: message });
}

async function applyAcknowledgement(
  batch: OutboxEvent[],
  result: EventBatchResponse,
): Promise<number> {
  const removableIds = new Set([...result.accepted, ...result.duplicated]);
  const rejected = new Map(
    result.rejected.flatMap(({ eventId, reasons }) =>
      eventId === null ? [] : ([[eventId, reasons.join('; ')]] as const),
    ),
  );
  const updates: OutboxEvent[] = [];
  let unacknowledgedCount = 0;

  for (const record of batch) {
    const rejectionReason = rejected.get(record.eventId);
    if (rejectionReason !== undefined) {
      updates.push({
        ...record,
        status: 'REJECTED',
        nextRetryAt: Number.MAX_SAFE_INTEGER,
        lastError: rejectionReason,
      });
    } else if (!removableIds.has(record.eventId)) {
      updates.push(retryRecord(record, 'Event was not acknowledged'));
      unacknowledgedCount += 1;
    }
  }
  await updateOutboxRecords(updates, [...removableIds]);
  return unacknowledgedCount;
}

function retryRecord(record: OutboxEvent, message: string): OutboxEvent {
  const retryCount = record.retryCount + 1;
  const delayIndex = Math.min(retryCount - 1, RETRY_DELAYS_MS.length - 1);
  return {
    ...record,
    retryCount,
    nextRetryAt: Date.now() + (RETRY_DELAYS_MS[delayIndex] ?? 60_000),
    lastError: message,
  };
}

async function updateOutboxRecords(updates: OutboxEvent[], deletes: string[]): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(EVENT_STORE, 'readwrite');
  const completion = transactionComplete(transaction);
  const store = transaction.objectStore(EVENT_STORE);
  for (const record of updates) store.put(record);
  for (const eventId of deletes) store.delete(eventId);
  await completion;
}

async function getAllEvents(): Promise<OutboxEvent[]> {
  const database = await openDatabase();
  const transaction = database.transaction(EVENT_STORE, 'readonly');
  const completion = transactionComplete(transaction);
  const result = await requestResult(transaction.objectStore(EVENT_STORE).getAll());
  await completion;
  return result as OutboxEvent[];
}

function compareEvents(left: OutboxEvent, right: OutboxEvent): number {
  return (
    left.sessionId.localeCompare(right.sessionId) ||
    left.sequenceNumber - right.sequenceNumber ||
    left.createdAt - right.createdAt
  );
}

function openDatabase(): Promise<IDBDatabase> {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(EVENT_STORE, { keyPath: 'eventId' });
      store.createIndex('status', 'status');
      store.createIndex('nextRetryAt', 'nextRetryAt');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open event outbox'));
  });
  return databasePromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB failed'));
  });
}

async function getSyncMetadata(): Promise<SyncMetadata> {
  const stored = await chrome.storage.local.get(SYNC_METADATA_KEY);
  const value: unknown = stored[SYNC_METADATA_KEY];
  if (typeof value !== 'object' || value === null) return emptySyncMetadata();
  return {
    lastAttemptAt: readNullableString(value, 'lastAttemptAt'),
    lastSuccessAt: readNullableString(value, 'lastSuccessAt'),
    lastError: readNullableString(value, 'lastError'),
  };
}

async function updateSyncMetadata(update: Partial<SyncMetadata>): Promise<void> {
  const current = await getSyncMetadata();
  await chrome.storage.local.set({ [SYNC_METADATA_KEY]: { ...current, ...update } });
}

function emptySyncMetadata(): SyncMetadata {
  return { lastAttemptAt: null, lastSuccessAt: null, lastError: null };
}

function readNullableString(value: object, property: keyof SyncMetadata): string | null {
  if (!(property in value)) return null;
  const candidate = value[property as keyof typeof value];
  return typeof candidate === 'string' ? candidate : null;
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
    value.rejected.every(isRejectedEvent)
  );
}

function isRejectedEvent(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'eventId' in value &&
    (value.eventId === null || typeof value.eventId === 'string') &&
    'reasons' in value &&
    isStringArray(value.reasons)
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
