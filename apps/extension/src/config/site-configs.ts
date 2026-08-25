import { getApiUrl } from './api';
import { DEFAULT_SITE_CONFIGS } from './site-defaults';
import { normalizeDomain } from '../extraction/generic-article.extractor';
import type { SiteExtractionConfig } from '../extraction/types';

const CACHE_DURATION_MS = 5 * 60 * 1000;
const CONFIG_CACHE_KEY = 'siteConfigCache';
const CONFIG_CACHE_TIME_KEY = 'siteConfigCacheUpdatedAt';
let cachedConfigs: SiteExtractionConfig[] | null = null;
let cachedAt = 0;

export async function loadSiteConfigs(): Promise<SiteExtractionConfig[]> {
  if (cachedConfigs !== null && Date.now() - cachedAt < CACHE_DURATION_MS) {
    return cachedConfigs;
  }

  const defaults = DEFAULT_SITE_CONFIGS.filter(({ enabled }) => enabled).map(cloneConfig);
  const stored = await loadStoredCache();
  if (stored !== null && Date.now() - stored.updatedAt < CACHE_DURATION_MS) {
    cachedConfigs = stored.configs;
    cachedAt = stored.updatedAt;
    return cachedConfigs;
  }

  try {
    const apiUrl = (await getApiUrl()).replace(/\/$/u, '');
    const response = await fetch(`${apiUrl}/site-configs?page=1&pageSize=100`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error(`Site config request failed with ${response.status}`);

    const payload: unknown = await response.json();
    const remoteConfigs = getConfigArray(payload);
    const remoteDomains = new Set(remoteConfigs.map(({ domain }) => normalizeDomain(domain)));
    cachedConfigs = [
      ...remoteConfigs.filter(({ enabled }) => enabled).map(cloneConfig),
      ...defaults.filter(({ domain }) => !remoteDomains.has(normalizeDomain(domain))),
    ];
    cachedAt = Date.now();
    await chrome.storage.local.set({
      [CONFIG_CACHE_KEY]: cachedConfigs,
      [CONFIG_CACHE_TIME_KEY]: cachedAt,
    });
  } catch {
    cachedConfigs = stored?.configs ?? defaults;
    cachedAt = stored?.updatedAt ?? Date.now();
  }

  return cachedConfigs;
}

async function loadStoredCache(): Promise<{
  configs: SiteExtractionConfig[];
  updatedAt: number;
} | null> {
  const stored = await chrome.storage.local.get([CONFIG_CACHE_KEY, CONFIG_CACHE_TIME_KEY]);
  const configs = stored[CONFIG_CACHE_KEY];
  const updatedAt = stored[CONFIG_CACHE_TIME_KEY];
  if (
    !Array.isArray(configs) ||
    !configs.every(isSiteExtractionConfig) ||
    typeof updatedAt !== 'number'
  ) {
    return null;
  }
  return { configs: configs.map(cloneConfig), updatedAt };
}

export function isSiteExtractionConfig(value: unknown): value is SiteExtractionConfig {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'domain' in value &&
    typeof value.domain === 'string' &&
    'enabled' in value &&
    typeof value.enabled === 'boolean' &&
    'articleUrlPatterns' in value &&
    isStringArray(value.articleUrlPatterns) &&
    'titleSelectors' in value &&
    isStringArray(value.titleSelectors) &&
    'contentSelectors' in value &&
    isStringArray(value.contentSelectors) &&
    'removeSelectors' in value &&
    isStringArray(value.removeSelectors)
  );
}

function getConfigArray(payload: unknown): SiteExtractionConfig[] {
  if (typeof payload !== 'object' || payload === null || !('data' in payload)) return [];
  return Array.isArray(payload.data) ? payload.data.filter(isSiteExtractionConfig) : [];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function cloneConfig(config: SiteExtractionConfig): SiteExtractionConfig {
  return {
    domain: normalizeDomain(config.domain),
    enabled: config.enabled,
    articleUrlPatterns: [...config.articleUrlPatterns],
    titleSelectors: [...config.titleSelectors],
    contentSelectors: [...config.contentSelectors],
    removeSelectors: [...config.removeSelectors],
  };
}
