import { API_URL_STORAGE_KEY, DEFAULT_API_URL } from '../config/api';
import { loadSiteConfigs } from '../config/site-configs';
import { isExtensionMessage, type TrackingContext } from '../messages';
import { enqueueReadingEvent, flushReadingEvents } from '../tracking/event-queue';

const BROWSER_ID_STORAGE_KEY = 'browserId';
const LAST_EXTRACTED_ARTICLE_KEY = 'lastExtractedArticle';
const EVENT_FLUSH_ALARM = 'flushReadingEvents';
const CHROME_IDLE_SECONDS = 60;
const SUPPORTED_ARTICLE_URLS = [
  'https://vnexpress.net/*',
  'https://dantri.com.vn/*',
  'https://tuoitre.vn/*',
];
let browserIdPromise: Promise<string> | null = null;

chrome.runtime.onInstalled.addListener(() => {
  void initializeBackground();
});

chrome.runtime.onStartup.addListener(() => {
  void initializeBackground();
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

  void enqueueReadingEvent(message.payload)
    .then(() => {
      sendResponse({ ok: true });
      void flushReadingEvents();
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
  if (alarm.name === EVENT_FLUSH_ALARM) void flushReadingEvents();
});

async function initializeBackground(): Promise<void> {
  const stored = await chrome.storage.sync.get(API_URL_STORAGE_KEY);
  if (typeof stored[API_URL_STORAGE_KEY] !== 'string') {
    await chrome.storage.sync.set({ [API_URL_STORAGE_KEY]: DEFAULT_API_URL });
  }
  await ensureBrowserId();
  chrome.idle.setDetectionInterval(CHROME_IDLE_SECONDS);
  void chrome.alarms.create(EVENT_FLUSH_ALARM, { periodInMinutes: 1 });
  await flushReadingEvents();
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

void initializeBackground();
