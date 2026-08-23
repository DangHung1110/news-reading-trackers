export const READING_EVENT_TYPES = [
  'PAGE_ENTER',
  'PAGE_ACTIVE',
  'PAGE_INACTIVE',
  'PAGE_LEAVE',
  'PAGE_HEARTBEAT',
] as const;

export type ReadingEventType = (typeof READING_EVENT_TYPES)[number];

export interface ReadingEventPayload {
  eventId: string;
  eventType: ReadingEventType;
  sessionId: string;
  sequenceNumber: number;
  occurredAt: string;
  url: string;
  canonicalUrl?: string;
  domain: string;
  title: string;
  content?: string;
  browserId: string;
  tabId: number;
  context: Record<string, unknown>;
}

export interface RejectedEvent {
  eventId: string | null;
  reasons: string[];
}

export interface EventBatchResponse {
  accepted: string[];
  duplicated: string[];
  rejected: RejectedEvent[];
}

export interface ArticleDto {
  id: string;
  canonicalUrl: string;
  domain: string;
  title: string;
  content: string;
  wordCount: number;
  summary: string | null;
  category: string | null;
  extractionStatus: string;
  firstCollectedAt: string;
  lastCollectedAt: string;
}

export interface ReadingSessionDto {
  id: string;
  sessionId: string;
  browserId: string;
  tabId: number;
  articleId: string;
  startedAt: string;
  endedAt: string | null;
  activeReadingMs: number;
  status: string;
  lastEventAt: string;
}

export interface SiteConfigDto {
  id: string;
  domain: string;
  enabled: boolean;
  articleUrlPatterns: string[];
  titleSelectors: string[];
  contentSelectors: string[];
  removeSelectors: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
}

export interface HealthResponse {
  status: 'ok';
  database: 'connected';
}
