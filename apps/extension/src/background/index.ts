import { API_URL_STORAGE_KEY, DEFAULT_API_URL } from '../config/api';

chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.sync.get(API_URL_STORAGE_KEY).then((stored) => {
    if (typeof stored[API_URL_STORAGE_KEY] !== 'string') {
      return chrome.storage.sync.set({ [API_URL_STORAGE_KEY]: DEFAULT_API_URL });
    }

    return undefined;
  });
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'TRACKER_PING'
  ) {
    sendResponse({ ok: true, timestamp: new Date().toISOString() });
  }
});
