import type {
  ArticleExtractor,
  ExtractedArticle,
  ExtractionStatus,
  SiteExtractionConfig,
} from './types';

const GENERIC_TITLE_SELECTORS = ['h1', '[itemprop="headline"]', '.article-title'];
const GENERIC_CONTENT_SELECTORS = [
  '[itemprop="articleBody"]',
  'article',
  '.article-content',
  '.detail-content',
  '.singular-content',
  'main',
];
const GENERIC_REMOVE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'iframe',
  'nav',
  'aside',
  'form',
  'button',
  '[aria-hidden="true"]',
  '.advertisement',
  '.related-news',
  '[class*="banner-ads"]',
  '[class*="ads-zone"]',
];

export class GenericArticleExtractor implements ArticleExtractor {
  constructor(
    private readonly defaultTitleSelectors = GENERIC_TITLE_SELECTORS,
    private readonly defaultContentSelectors = GENERIC_CONTENT_SELECTORS,
    private readonly defaultRemoveSelectors = GENERIC_REMOVE_SELECTORS,
  ) {}

  extract(document: Document, url: string, config: SiteExtractionConfig): ExtractedArticle {
    const title = this.extractTitle(document, [
      ...config.titleSelectors,
      ...this.defaultTitleSelectors,
    ]);
    const contentElement = this.queryFirst(document, [
      ...config.contentSelectors,
      ...this.defaultContentSelectors,
    ]);
    const content =
      contentElement === null
        ? ''
        : this.extractContent(contentElement, [
            ...config.removeSelectors,
            ...this.defaultRemoveSelectors,
          ]);

    return {
      url,
      canonicalUrl: this.extractCanonicalUrl(document, url),
      domain: normalizeDomain(new URL(url).hostname),
      title,
      content,
      wordCount: countWords(content),
      extractionStatus: this.getStatus(title, content),
    };
  }

  private extractTitle(document: Document, selectors: string[]): string {
    const selectedTitle = this.queryFirst(document, selectors)?.textContent;
    if (selectedTitle !== null && selectedTitle !== undefined) {
      const normalized = normalizeWhitespace(selectedTitle);
      if (normalized.length > 0) return normalized;
    }

    const openGraphTitle = document
      .querySelector<HTMLMetaElement>('meta[property="og:title"]')
      ?.content.trim();
    return normalizeWhitespace(openGraphTitle ?? document.title);
  }

  private extractContent(element: Element, removeSelectors: string[]): string {
    const clone = element.cloneNode(true) as Element;
    for (const selector of removeSelectors) {
      try {
        clone.querySelectorAll(selector).forEach((node) => node.remove());
      } catch {
        // A stale remote selector must not break extraction.
      }
    }

    const blocks = [...clone.querySelectorAll('p, h2, h3, blockquote, li')]
      .map((node) => normalizeWhitespace(node.textContent ?? ''))
      .filter((text) => text.length > 0);
    return blocks.length > 0 ? blocks.join('\n') : normalizeWhitespace(clone.textContent ?? '');
  }

  private extractCanonicalUrl(document: Document, currentUrl: string): string {
    const canonicalHref = document
      .querySelector<HTMLLinkElement>('link[rel="canonical"]')
      ?.getAttribute('href');

    try {
      return normalizeArticleUrl(new URL(canonicalHref ?? currentUrl, currentUrl).toString());
    } catch {
      return normalizeArticleUrl(currentUrl);
    }
  }

  private queryFirst(document: Document, selectors: string[]): Element | null {
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element !== null) return element;
      } catch {
        // Continue to fallback selectors when a remote selector is invalid.
      }
    }
    return null;
  }

  private getStatus(title: string, content: string): ExtractionStatus {
    if (title.length > 0 && content.length >= 200) return 'SUCCESS';
    if (title.length > 0 || content.length >= 50) return 'PARTIAL';
    return 'FAILED';
  }
}

export function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^www\./u, '');
}

export function normalizeArticleUrl(input: string): string {
  const url = new URL(input);
  url.hash = '';
  url.hostname = normalizeDomain(url.hostname);
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/$/u, '');

  for (const parameter of [...url.searchParams.keys()]) {
    const normalized = parameter.toLowerCase();
    if (
      normalized.startsWith('utm_') ||
      ['fbclid', 'gclid', 'dclid', 'ref', 'referrer'].includes(normalized)
    ) {
      url.searchParams.delete(parameter);
    }
  }
  url.searchParams.sort();
  return url.toString();
}

export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/gu, ' ').trim();
}

export function countWords(content: string): number {
  const normalized = normalizeWhitespace(content);
  return normalized.length === 0 ? 0 : normalized.split(' ').length;
}
