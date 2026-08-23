import type { ReadingEventPayload } from '@news-tracker/contracts';

import { DEFAULT_SITE_CONFIGS } from '../config/site-defaults';
import { isSiteExtractionConfig } from '../config/site-configs';
import { extractArticle } from '../extraction/extract-article';
import type { SiteExtractionConfig } from '../extraction/types';
import {
  isTrackingContextChangedMessage,
  type SiteConfigsResponse,
  type TrackingContext,
  type TrackingContextResponse,
} from '../messages';
import { ReadingSessionTracker, type TrackingEvent } from '../tracking/reading-session-tracker';

const INTERACTION_IDLE_TIMEOUT_MS = 30_000;
const INTERACTION_THROTTLE_MS = 1_000;
let tracker: ReadingSessionTracker | null = null;
let lastInteractionAt = 0;

async function runExtraction(): Promise<void> {
  const configs = await requestSiteConfigs();
  const article = extractArticle(document, window.location.href, configs);

  if (article === null) {
    document.documentElement.dataset.newsReadingTracker = 'not-article';
    return;
  }

  if (article.extractionStatus === 'FAILED' || article.title.length === 0) {
    document.documentElement.dataset.newsReadingTracker = 'extraction-failed';
    return;
  }

  void sendMessage({ type: 'ARTICLE_EXTRACTED', payload: article }).catch(() => undefined);
  const trackingContext = await requestTrackingContext();
  const sessionId = crypto.randomUUID();
  tracker = new ReadingSessionTracker(
    (event) => emitReadingEvent(event, article, trackingContext, sessionId),
    INTERACTION_IDLE_TIMEOUT_MS,
  );
  bindTrackingSignals();
  tracker.start({
    pageVisible: document.visibilityState === 'visible',
    tabActive: trackingContext.tabActive,
    windowFocused: trackingContext.windowFocused,
    browserIdle: trackingContext.browserIdle,
  });
}

async function requestSiteConfigs(): Promise<SiteExtractionConfig[]> {
  try {
    const response = await sendMessage({ type: 'GET_SITE_CONFIGS' });
    if (isSiteConfigsResponse(response)) return response.data;
  } catch {
    // Use built-in defaults when the service worker is unavailable.
  }
  return DEFAULT_SITE_CONFIGS.map((config) => ({ ...config }));
}

async function requestTrackingContext(): Promise<TrackingContext> {
  const response = await sendMessage({ type: 'GET_TRACKING_CONTEXT' });
  if (!isTrackingContextResponse(response)) {
    throw new Error('Background worker did not provide tracking context');
  }
  return response.data;
}

function emitReadingEvent(
  event: TrackingEvent,
  article: NonNullable<ReturnType<typeof extractArticle>>,
  trackingContext: TrackingContext,
  sessionId: string,
): void {
  const payload: ReadingEventPayload = {
    eventId: crypto.randomUUID(),
    eventType: event.eventType,
    sessionId,
    sequenceNumber: event.sequenceNumber,
    occurredAt: event.occurredAt,
    url: article.url,
    canonicalUrl: article.canonicalUrl,
    domain: article.domain,
    title: article.title,
    browserId: trackingContext.browserId,
    tabId: trackingContext.tabId,
    context: { ...event.context, extractionStatus: article.extractionStatus },
  };
  if (event.eventType === 'PAGE_ENTER') payload.content = article.content;

  if (event.eventType !== 'PAGE_HEARTBEAT') {
    document.documentElement.dataset.newsReadingTracker = event.eventType
      .replace('PAGE_', '')
      .toLowerCase();
  }
  void sendMessage({ type: 'READING_EVENT', payload }).catch(() => undefined);
}

function bindTrackingSignals(): void {
  document.addEventListener('visibilitychange', () => {
    tracker?.updateConditions({ pageVisible: document.visibilityState === 'visible' });
  });
  chrome.runtime.onMessage.addListener((message: unknown) => {
    if (!isTrackingContextChangedMessage(message)) return false;
    tracker?.updateConditions(message.payload);
    return false;
  });

  const recordInteraction = () => {
    const now = Date.now();
    if (now - lastInteractionAt < INTERACTION_THROTTLE_MS) return;
    lastInteractionAt = now;
    tracker?.recordInteraction();
  };
  for (const eventName of ['scroll', 'click', 'keydown', 'touchstart', 'mousemove']) {
    window.addEventListener(eventName, recordInteraction, { passive: true });
  }

  const leave = () => tracker?.leave();
  window.addEventListener('pagehide', leave);
  window.addEventListener('beforeunload', leave);
  window.addEventListener('online', () => {
    void sendMessage({ type: 'SYNC_NOW' }).catch(() => undefined);
  });
}

function sendMessage(message: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: unknown) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError === undefined) resolve(response);
      else reject(new Error(runtimeError.message));
    });
  });
}

function isSiteConfigsResponse(value: unknown): value is SiteConfigsResponse {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'ok' in value &&
    value.ok === true &&
    'data' in value &&
    Array.isArray(value.data) &&
    value.data.every(isSiteExtractionConfig)
  );
}

function isTrackingContextResponse(value: unknown): value is Required<TrackingContextResponse> {
  if (typeof value !== 'object' || value === null) return false;
  if (!('ok' in value) || value.ok !== true || !('data' in value)) return false;
  const data = value.data;
  return (
    typeof data === 'object' &&
    data !== null &&
    'browserId' in data &&
    typeof data.browserId === 'string' &&
    'tabId' in data &&
    typeof data.tabId === 'number' &&
    'tabActive' in data &&
    typeof data.tabActive === 'boolean' &&
    'windowFocused' in data &&
    typeof data.windowFocused === 'boolean' &&
    'browserIdle' in data &&
    typeof data.browserIdle === 'boolean'
  );
}

void runExtraction().catch(() => {
  document.documentElement.dataset.newsReadingTracker = 'failed';
});
