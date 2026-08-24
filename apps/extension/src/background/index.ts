import { API_URL_STORAGE_KEY, DEFAULT_API_URL } from '../config/api';
import { loadSiteConfigs } from '../config/site-configs';
import { isExtensionMessage, type TrackingContext } from '../messages';
import {
  enqueueReadingEvent,
  flushReadingEvents,
  getEventSyncStatus,
  getNextRetryAt,
  migrateLegacyEventQueue,
} from '../tracking/event-queue';

const BROWSER_ID_STORAGE_KEY = 'browserId';
const LAST_EXTRACTED_ARTICLE_KEY = 'lastExtractedArticle';
const EVENT_SYNC_ALARM = 'syncReadingEvents';
const EVENT_SAFETY_ALARM = 'periodicReadingEventSync';
const CHROME_IDLE_SECONDS = 60;
const SUPPORTED_ARTICLE_URLS = [
  'https://vnexpress.net/*',
  'https://dantri.com.vn/*',
  'https://tuoitre.vn/*',
];
let browserIdPromise: Promise<string> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

chrome.runtime.onInstalled.addListener(() => {
  void initializeBackground().catch(() => undefined);
});

chrome.runtime.onStartup.addListener(() => {
  void initializeBackground().catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!isExtensionMessage(message)) return false;

  if (message.type === 'GET_SITE_CONFIGS') {
    void loadSiteConfigs()
      .then((configs) => sendResponse({ ok: true, data: configs }))
      .catch(() => sendResponse({ ok: false, data: [] }));
    return true;
  }

  if (message.type === 'ARTICLE_EXTRACTED') {
    void chrome.storage.local
      .set({ [LAST_EXTRACTED_ARTICLE_KEY]: message.payload })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === 'GET_TRACKING_CONTEXT') {
    void getTrackingContext(sender)
      .then((data) => sendResponse({ ok: true, data }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === 'GET_SYNC_STATUS') {
    void getEventSyncStatus()
      .then((data) => sendResponse({ ok: true, data }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === 'SYNC_NOW') {
    void syncAndSchedule()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  void enqueueReadingEvent(message.payload)
    .then(() => {
      sendResponse({ ok: true });
      void syncAndSchedule();
    })
    .catch(() => sendResponse({ ok: false }));
  return true;
});

chrome.tabs.onActivated.addListener(() => {
  void notifyTrackingContexts();
});

chrome.windows.onFocusChanged.addListener(() => {
  void notifyTrackingContexts();
});

chrome.idle.onStateChanged.addListener(() => {
  void notifyTrackingContexts();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === EVENT_SYNC_ALARM || alarm.name === EVENT_SAFETY_ALARM) {
    void syncAndSchedule();
  }
});

globalThis.addEventListener('online', () => {
  void syncAndSchedule();
});

async function initializeBackground(): Promise<void> {
  const stored = await chrome.storage.sync.get(API_URL_STORAGE_KEY);
  if (typeof stored[API_URL_STORAGE_KEY] !== 'string') {
    await chrome.storage.sync.set({ [API_URL_STORAGE_KEY]: DEFAULT_API_URL });
  }
  await ensureBrowserId();
  await migrateLegacyEventQueue();
  chrome.idle.setDetectionInterval(CHROME_IDLE_SECONDS);
  void chrome.alarms.create(EVENT_SAFETY_ALARM, { periodInMinutes: 1 });
  await syncAndSchedule();
}

async function syncAndSchedule(): Promise<void> {
  await flushReadingEvents();
  const nextRetryAt = await getNextRetryAt();
  if (retryTimer !== null) clearTimeout(retryTimer);
  retryTimer = null;

  if (nextRetryAt === null) {
    await chrome.alarms.clear(EVENT_SYNC_ALARM);
    return;
  }
  const delay = Math.max(1_000, nextRetryAt - Date.now());
  void chrome.alarms.create(EVENT_SYNC_ALARM, { when: Date.now() + delay });
  retryTimer = setTimeout(() => void syncAndSchedule(), delay);
}

function ensureBrowserId(): Promise<string> {
  browserIdPromise ??= loadOrCreateBrowserId();
  return browserIdPromise;
}

async function loadOrCreateBrowserId(): Promise<string> {
  const stored = await chrome.storage.local.get(BROWSER_ID_STORAGE_KEY);
  const current = stored[BROWSER_ID_STORAGE_KEY];
  if (typeof current === 'string' && current.length > 0) return current;

  const browserId = crypto.randomUUID();
  await chrome.storage.local.set({ [BROWSER_ID_STORAGE_KEY]: browserId });
  return browserId;
}

async function getTrackingContext(sender: chrome.runtime.MessageSender): Promise<TrackingContext> {
  const tab = sender.tab;
  if (tab?.id === undefined) throw new Error('Tracking context requires a browser tab');

  const [browserId, browserState, window] = await Promise.all([
    ensureBrowserId(),
    chrome.idle.queryState(CHROME_IDLE_SECONDS),
    chrome.windows.get(tab.windowId),
  ]);
  return {
    browserId,
    tabId: tab.id,
    tabActive: tab.active,
    windowFocused: window.focused,
    browserIdle: browserState !== 'active',
  };
}

async function notifyTrackingContexts(): Promise<void> {
  const [tabs, windows, browserState] = await Promise.all([
    chrome.tabs.query({ url: SUPPORTED_ARTICLE_URLS }),
    chrome.windows.getAll(),
    chrome.idle.queryState(CHROME_IDLE_SECONDS),
  ]);
  const focusedWindowIds = new Set(
    windows
      .filter(({ focused }) => focused)
      .map(({ id }) => id)
      .filter((id) => id !== undefined),
  );

  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id === undefined) return;
      await chrome.tabs
        .sendMessage(tab.id, {
          type: 'TRACKING_CONTEXT_CHANGED',
          payload: {
            tabActive: tab.active,
            windowFocused: focusedWindowIds.has(tab.windowId),
            browserIdle: browserState !== 'active',
          },
        })
        .catch(() => undefined);
    }),
  );
}

void initializeBackground().catch(() => undefined);
