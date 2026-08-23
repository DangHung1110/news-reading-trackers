import type { ReadingEventPayload } from '@news-tracker/contracts';

import { EXTRACTION_STATUSES } from './extraction/types';
import type { ExtractedArticle, SiteExtractionConfig } from './extraction/types';

const TRACKED_EVENT_TYPES: readonly ReadingEventPayload['eventType'][] = [
  'PAGE_ENTER',
  'PAGE_ACTIVE',
  'PAGE_INACTIVE',
  'PAGE_LEAVE',
  'PAGE_HEARTBEAT',
];

export interface GetSiteConfigsMessage {
  type: 'GET_SITE_CONFIGS';
}

export interface ArticleExtractedMessage {
  type: 'ARTICLE_EXTRACTED';
  payload: ExtractedArticle;
}

export interface GetTrackingContextMessage {
  type: 'GET_TRACKING_CONTEXT';
}

export interface ReadingEventMessage {
  type: 'READING_EVENT';
  payload: ReadingEventPayload;
}

export interface GetSyncStatusMessage {
  type: 'GET_SYNC_STATUS';
}

export interface SyncNowMessage {
  type: 'SYNC_NOW';
}

export interface EventSyncStatus {
  pendingCount: number;
  rejectedCount: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

export interface TrackingContext {
  browserId: string;
  tabId: number;
  tabActive: boolean;
  windowFocused: boolean;
  browserIdle: boolean;
}

export interface TrackingContextChangedMessage {
  type: 'TRACKING_CONTEXT_CHANGED';
  payload: Omit<TrackingContext, 'browserId' | 'tabId'>;
}

export type ExtensionMessage =
  | GetSiteConfigsMessage
  | ArticleExtractedMessage
  | GetTrackingContextMessage
  | ReadingEventMessage
  | GetSyncStatusMessage
  | SyncNowMessage;

export interface SiteConfigsResponse {
  ok: boolean;
  data: SiteExtractionConfig[];
}

export interface TrackingContextResponse {
  ok: boolean;
  data?: TrackingContext;
}

export interface SyncStatusResponse {
  ok: boolean;
  data?: EventSyncStatus;
}

export function isExtensionMessage(message: unknown): message is ExtensionMessage {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false;
  if (
    message.type === 'GET_SITE_CONFIGS' ||
    message.type === 'GET_TRACKING_CONTEXT' ||
    message.type === 'GET_SYNC_STATUS' ||
    message.type === 'SYNC_NOW'
  ) {
    return true;
  }
  if (!('payload' in message)) return false;
  if (message.type === 'ARTICLE_EXTRACTED') return isExtractedArticle(message.payload);
  return message.type === 'READING_EVENT' && isReadingEventPayload(message.payload);
}

export function isTrackingContextChangedMessage(
  message: unknown,
): message is TrackingContextChangedMessage {
  if (
    typeof message !== 'object' ||
    message === null ||
    !('type' in message) ||
    message.type !== 'TRACKING_CONTEXT_CHANGED' ||
    !('payload' in message)
  ) {
    return false;
  }
  const payload = message.payload;
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'tabActive' in payload &&
    typeof payload.tabActive === 'boolean' &&
    'windowFocused' in payload &&
    typeof payload.windowFocused === 'boolean' &&
    'browserIdle' in payload &&
    typeof payload.browserIdle === 'boolean'
  );
}

function isExtractedArticle(value: unknown): value is ExtractedArticle {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'url' in value &&
    typeof value.url === 'string' &&
    'canonicalUrl' in value &&
    typeof value.canonicalUrl === 'string' &&
    'domain' in value &&
    typeof value.domain === 'string' &&
    'title' in value &&
    typeof value.title === 'string' &&
    'content' in value &&
    typeof value.content === 'string' &&
    'wordCount' in value &&
    typeof value.wordCount === 'number' &&
    'extractionStatus' in value &&
    EXTRACTION_STATUSES.includes(value.extractionStatus as ExtractedArticle['extractionStatus'])
  );
}

export function isReadingEventPayload(value: unknown): value is ReadingEventPayload {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'eventId' in value &&
    typeof value.eventId === 'string' &&
    'eventType' in value &&
    TRACKED_EVENT_TYPES.includes(value.eventType as ReadingEventPayload['eventType']) &&
    'sessionId' in value &&
    typeof value.sessionId === 'string' &&
    'sequenceNumber' in value &&
    typeof value.sequenceNumber === 'number' &&
    Number.isInteger(value.sequenceNumber) &&
    value.sequenceNumber >= 0 &&
    'occurredAt' in value &&
    typeof value.occurredAt === 'string' &&
    'url' in value &&
    typeof value.url === 'string' &&
    'domain' in value &&
    typeof value.domain === 'string' &&
    'title' in value &&
    typeof value.title === 'string' &&
    'browserId' in value &&
    typeof value.browserId === 'string' &&
    'tabId' in value &&
    typeof value.tabId === 'number' &&
    Number.isInteger(value.tabId) &&
    value.tabId >= 0 &&
    'context' in value &&
    typeof value.context === 'object' &&
    value.context !== null &&
    !Array.isArray(value.context)
  );
}
