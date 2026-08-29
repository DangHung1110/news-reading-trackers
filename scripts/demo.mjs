import { randomUUID } from 'node:crypto';

const apiUrl = (process.env.DEMO_API_URL ?? 'http://localhost:3000/api').replace(/\/$/u, '');
const dashboardUrl = (process.env.DEMO_WEB_URL ?? 'http://localhost:3001').replace(/\/$/u, '');
const sessionId = randomUUID();
const browserId = randomUUID();
const startedAt = Date.now();
const title = `Demo reading session ${sessionId.slice(0, 8)}`;
const url = `https://vnexpress.net/demo-${sessionId}.html`;
const steps = [
  ['PAGE_ENTER', 0, 0],
  ['PAGE_ACTIVE', 1, 1_000],
  ['PAGE_INACTIVE', 2, 6_000],
  ['PAGE_ACTIVE', 3, 9_000],
  ['PAGE_LEAVE', 4, 15_000],
];
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
  content:
    eventType === 'PAGE_ENTER' ? 'Nội dung demo cho News Reading Activity Tracker.' : undefined,
  browserId,
  tabId: 1,
  context: { demo: true },
}));

const response = await fetch(`${apiUrl}/events`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ events }),
});
if (!response.ok) throw new Error(`Demo failed with HTTP ${response.status}`);

const result = await response.json();
console.log('Demo events:', result);
console.log('Session ID:', sessionId);
console.log('Expected active reading time: 11 seconds');
console.log('Dashboard:', `${dashboardUrl}/sessions`);
