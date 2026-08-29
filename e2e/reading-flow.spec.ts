import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import type {
  EventBatchResponse,
  PaginatedResponse,
  ReadingSessionListItemDto,
} from '@news-tracker/contracts';

const apiUrl = process.env.E2E_API_URL ?? 'http://localhost:3000/api';

test('records a reading flow once and displays its timeline on the dashboard', async ({
  page,
  request,
}) => {
  const runId = randomUUID();
  const sessionId = randomUUID();
  const browserId = randomUUID();
  const startedAt = Date.now();
  const title = `Playwright reading flow ${runId}`;
  const url = `https://vnexpress.net/playwright-${runId}.html`;
  const steps = [
    ['PAGE_ENTER', 0, 0],
    ['PAGE_ACTIVE', 1, 1_000],
    ['PAGE_INACTIVE', 2, 4_000],
    ['PAGE_ACTIVE', 3, 6_000],
    ['PAGE_LEAVE', 4, 10_000],
  ] as const;
  const events = steps.map(([eventType, sequenceNumber, offset]) => ({
    eventId: randomUUID(),
    eventType,
    sessionId,
    sequenceNumber,
    occurredAt: new Date(startedAt + offset).toISOString(),
    url,
    canonicalUrl: url,
    domain: 'vnexpress.net',
    title,
    content: eventType === 'PAGE_ENTER' ? 'Nội dung kiểm thử Playwright.' : undefined,
    browserId,
    tabId: 1,
    context: { visible: eventType !== 'PAGE_INACTIVE' },
  }));

  const accepted = await request.post(`${apiUrl}/events`, { data: { events } });
  expect(accepted.ok()).toBeTruthy();
  const acceptedPayload = (await accepted.json()) as EventBatchResponse;
  expect(acceptedPayload.accepted).toHaveLength(5);

  const duplicate = await request.post(`${apiUrl}/events`, { data: { events } });
  expect(duplicate.ok()).toBeTruthy();
  const duplicatePayload = (await duplicate.json()) as EventBatchResponse;
  expect(duplicatePayload.duplicated).toHaveLength(5);

  const sessions = await request.get(`${apiUrl}/sessions?search=${sessionId}`);
  const sessionPayload = (await sessions.json()) as PaginatedResponse<ReadingSessionListItemDto>;
  expect(sessionPayload.data).toHaveLength(1);
  expect(sessionPayload.data[0]).toMatchObject({
    sessionId,
    status: 'COMPLETED',
    activeReadingMs: 7_000,
    eventCount: 5,
  });

  await page.goto('/sessions');
  await page.getByLabel('Tìm phiên đọc').fill(sessionId);
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByText('7 giây')).toBeVisible();
  await page.getByRole('link', { name: 'Xem' }).click();

  await expect(page.getByText('PAGE_ENTER')).toHaveCount(1);
  await expect(page.getByText('PAGE_ACTIVE')).toHaveCount(2);
  await expect(page.getByText('PAGE_INACTIVE')).toHaveCount(1);
  await expect(page.getByText('PAGE_LEAVE')).toHaveCount(1);
});
