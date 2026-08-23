import { DEFAULT_SITE_CONFIGS } from '../config/site-defaults';
import { isSiteExtractionConfig } from '../config/site-configs';
import { extractArticle } from '../extraction/extract-article';
import type { SiteExtractionConfig } from '../extraction/types';
import type { SiteConfigsResponse } from '../messages';

async function runExtraction(): Promise<void> {
  const configs = await requestSiteConfigs();
  const article = extractArticle(document, window.location.href, configs);

  if (article === null) {
    document.documentElement.dataset.newsReadingTracker = 'not-article';
    return;
  }

  document.documentElement.dataset.newsReadingTracker = article.extractionStatus.toLowerCase();
  await sendMessage({ type: 'ARTICLE_EXTRACTED', payload: article });
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

void runExtraction().catch(() => {
  document.documentElement.dataset.newsReadingTracker = 'failed';
});
