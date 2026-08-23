export const EXTRACTION_STATUSES = ['SUCCESS', 'PARTIAL', 'FAILED'] as const;
export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

export interface SiteExtractionConfig {
  domain: string;
  enabled: boolean;
  articleUrlPatterns: string[];
  titleSelectors: string[];
  contentSelectors: string[];
  removeSelectors: string[];
}

export interface ExtractedArticle {
  url: string;
  canonicalUrl: string;
  domain: string;
  title: string;
  content: string;
  wordCount: number;
  extractionStatus: ExtractionStatus;
}

export interface ArticleExtractor {
  extract(document: Document, url: string, config: SiteExtractionConfig): ExtractedArticle;
}
