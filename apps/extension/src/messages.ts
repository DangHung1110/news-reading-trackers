import { EXTRACTION_STATUSES } from './extraction/types';
import type { ExtractedArticle, SiteExtractionConfig } from './extraction/types';

export interface GetSiteConfigsMessage {
  type: 'GET_SITE_CONFIGS';
}

export interface ArticleExtractedMessage {
  type: 'ARTICLE_EXTRACTED';
  payload: ExtractedArticle;
}

export type ExtensionMessage = GetSiteConfigsMessage | ArticleExtractedMessage;

export interface SiteConfigsResponse {
  ok: boolean;
  data: SiteExtractionConfig[];
}

export function isExtensionMessage(message: unknown): message is ExtensionMessage {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false;
  if (message.type === 'GET_SITE_CONFIGS') return true;
  return (
    message.type === 'ARTICLE_EXTRACTED' &&
    'payload' in message &&
    isExtractedArticle(message.payload)
  );
}

function isExtractedArticle(value: unknown): value is ExtractedArticle {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'url' in value &&
    typeof value.url === 'string' &&
    'canonicalUrl' in value &&
    typeof value.canonicalUrl === 'string' &&
    'domain' in value &&
    typeof value.domain === 'string' &&
    'title' in value &&
    typeof value.title === 'string' &&
    'content' in value &&
    typeof value.content === 'string' &&
    'wordCount' in value &&
    typeof value.wordCount === 'number' &&
    'extractionStatus' in value &&
    EXTRACTION_STATUSES.includes(value.extractionStatus as ExtractedArticle['extractionStatus'])
  );
}
