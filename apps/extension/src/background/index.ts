import { API_URL_STORAGE_KEY, DEFAULT_API_URL } from '../config/api';
import { loadSiteConfigs } from '../config/site-configs';
import { isExtensionMessage } from '../messages';

const LAST_EXTRACTED_ARTICLE_KEY = 'lastExtractedArticle';

chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.sync.get(API_URL_STORAGE_KEY).then((stored) => {
    if (typeof stored[API_URL_STORAGE_KEY] !== 'string') {
      return chrome.storage.sync.set({ [API_URL_STORAGE_KEY]: DEFAULT_API_URL });
    }
    return undefined;
  });
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isExtensionMessage(message)) return false;

  if (message.type === 'GET_SITE_CONFIGS') {
    void loadSiteConfigs()
      .then((configs) => sendResponse({ ok: true, data: configs }))
      .catch(() => sendResponse({ ok: false, data: [] }));
    return true;
  }

  void chrome.storage.local
    .set({ [LAST_EXTRACTED_ARTICLE_KEY]: message.payload })
    .then(() => sendResponse({ ok: true }))
    .catch(() => sendResponse({ ok: false }));
  return true;
});
