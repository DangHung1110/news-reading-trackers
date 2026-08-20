import { z } from 'zod';

import { READING_EVENT_TYPES } from '@news-tracker/contracts';

export const readingEventSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.enum(READING_EVENT_TYPES),
  sessionId: z.string().min(1),
  sequenceNumber: z.number().int().nonnegative(),
  occurredAt: z.iso.datetime({ offset: true }),
  url: z.url(),
  canonicalUrl: z.url().optional(),
  domain: z.string().min(1),
  title: z.string().min(1),
  browserId: z.string().min(1),
  tabId: z.number().int(),
  context: z.record(z.string(), z.unknown()),
});

export type ValidatedReadingEvent = z.infer<typeof readingEventSchema>;
