import { DanTriExtractor } from './dantri.extractor';
import {
  GenericArticleExtractor,
  normalizeArticleUrl,
  normalizeDomain,
} from './generic-article.extractor';
import type { ArticleExtractor, ExtractedArticle, SiteExtractionConfig } from './types';
import { TuoiTreExtractor } from './tuoitre.extractor';
import { VnExpressExtractor } from './vnexpress.extractor';

const extractors: Record<string, ArticleExtractor> = {
  'vnexpress.net': new VnExpressExtractor(),
  'dantri.com.vn': new DanTriExtractor(),
  'tuoitre.vn': new TuoiTreExtractor(),
};
const genericExtractor = new GenericArticleExtractor();

export function extractArticle(
  document: Document,
  url: string,
  configs: readonly SiteExtractionConfig[],
): ExtractedArticle | null {
  const config = findMatchingSiteConfig(url, configs);
  if (config === null) return null;

  const specific = (extractors[config.domain] ?? genericExtractor).extract(document, url, config);
  if (specific.extractionStatus === 'SUCCESS') return specific;

  const fallback = genericExtractor.extract(document, url, {
    ...config,
    titleSelectors: [],
    contentSelectors: [],
  });
  return extractionScore(fallback) > extractionScore(specific) ? fallback : specific;
}

export function findMatchingSiteConfig(
  input: string,
  configs: readonly SiteExtractionConfig[],
): SiteExtractionConfig | null {
  let normalizedUrl: string;
  let domain: string;
  try {
    normalizedUrl = normalizeArticleUrl(input);
    domain = normalizeDomain(new URL(normalizedUrl).hostname);
  } catch {
    return null;
  }

  const config = configs.find(
    (candidate) => candidate.enabled && normalizeDomain(candidate.domain) === domain,
  );
  if (config === undefined) return null;

  const matchesPattern = config.articleUrlPatterns.some((pattern) => {
    try {
      return new RegExp(pattern, 'u').test(normalizedUrl);
    } catch {
      return false;
    }
  });
  return matchesPattern ? config : null;
}

function extractionScore(article: ExtractedArticle): number {
  const statusScore = { SUCCESS: 2_000_000, PARTIAL: 1_000_000, FAILED: 0 }[
    article.extractionStatus
  ];
  return statusScore + article.content.length + article.title.length;
}
