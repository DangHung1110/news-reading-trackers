import { getApiUrl } from './api';
import { DEFAULT_SITE_CONFIGS } from './site-defaults';
import { normalizeDomain } from '../extraction/generic-article.extractor';
import type { SiteExtractionConfig } from '../extraction/types';

const CACHE_DURATION_MS = 5 * 60 * 1000;
let cachedConfigs: SiteExtractionConfig[] | null = null;
let cachedAt = 0;

export async function loadSiteConfigs(): Promise<SiteExtractionConfig[]> {
  if (cachedConfigs !== null && Date.now() - cachedAt < CACHE_DURATION_MS) {
    return cachedConfigs;
  }

  const defaults = DEFAULT_SITE_CONFIGS.map(cloneConfig);
  try {
    const apiUrl = (await getApiUrl()).replace(/\/$/u, '');
    const response = await fetch(`${apiUrl}/site-configs?page=1&pageSize=100`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error(`Site config request failed with ${response.status}`);

    const payload: unknown = await response.json();
    const remoteConfigs = getConfigArray(payload);
    cachedConfigs = defaults.map((defaultConfig) => {
      const remote = remoteConfigs.find(
        (config) => normalizeDomain(config.domain) === normalizeDomain(defaultConfig.domain),
      );
      return remote === undefined ? defaultConfig : cloneConfig(remote);
    });
  } catch {
    cachedConfigs = defaults;
  }

  cachedAt = Date.now();
  return cachedConfigs;
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
