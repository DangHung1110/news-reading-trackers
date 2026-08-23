import type { SiteExtractionConfig } from '../extraction/types';

export const DEFAULT_SITE_CONFIGS: readonly SiteExtractionConfig[] = [
  {
    domain: 'vnexpress.net',
    enabled: true,
    articleUrlPatterns: ['^https://vnexpress\\.net/.+-\\d+\\.html$'],
    titleSelectors: ['h1.title-detail'],
    contentSelectors: ['article.fck_detail', '.fck_detail'],
    removeSelectors: ['.social_pin', '.box-tinlienquan', '.banner-ads', '.ads'],
  },
  {
    domain: 'dantri.com.vn',
    enabled: true,
    articleUrlPatterns: ['^https://dantri\\.com\\.vn/.+-\\d{17}\\.htm$'],
    titleSelectors: ['h1.title-page', 'h1.article-title'],
    contentSelectors: ['.singular-content', '.e-magazine__body'],
    removeSelectors: ['.related-news', '.ads-wrapper', '.article-actions'],
  },
  {
    domain: 'tuoitre.vn',
    enabled: true,
    articleUrlPatterns: ['^https://tuoitre\\.vn/.+-\\d+\\.htm$'],
    titleSelectors: ['h1.detail-title', 'h1.article-title'],
    contentSelectors: ['.detail-content', '#main-detail-body'],
    removeSelectors: ['.VCSortableInPreviewMode', '.related-news', '.ads-zone'],
  },
];
