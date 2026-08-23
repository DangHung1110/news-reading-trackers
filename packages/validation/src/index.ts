import { z } from 'zod';

import { READING_EVENT_TYPES } from '@news-tracker/contracts';

const httpUrlSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === 'http:' || protocol === 'https:';
}, 'URL must use HTTP or HTTPS');

export const readingEventSchema = z
  .object({
    eventId: z.uuid(),
    eventType: z.enum(READING_EVENT_TYPES),
    sessionId: z.uuid(),
    sequenceNumber: z.number().int().nonnegative(),
    occurredAt: z.iso.datetime({ offset: true }),
    url: httpUrlSchema,
    canonicalUrl: httpUrlSchema.optional(),
    domain: z.string().trim().min(1).max(253),
    title: z.string().trim().min(1).max(1000),
    content: z.string().max(2_000_000).optional(),
    browserId: z.uuid(),
    tabId: z.number().int().nonnegative(),
    context: z.record(z.string(), z.json()),
  })
  .strict()
  .superRefine((event, context) => {
    const urlDomain = new URL(event.url).hostname.toLowerCase().replace(/^www\./u, '');
    const eventDomain = event.domain.toLowerCase().replace(/^www\./u, '');
    if (urlDomain !== eventDomain) {
      context.addIssue({
        code: 'custom',
        path: ['domain'],
        message: 'Domain must match the event URL',
      });
    }
  });

export type ValidatedReadingEvent = z.infer<typeof readingEventSchema>;
