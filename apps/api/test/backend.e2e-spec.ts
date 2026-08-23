import { randomUUID } from 'node:crypto';

import { type INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ReadingSessionStatus } from '@prisma/client';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { SessionsService } from '../src/modules/sessions/sessions.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Backend data API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  type SupertestApp = Parameters<typeof request>[0];

  const runId = randomUUID();
  const enterEventId = randomUUID();
  const activeEventId = randomUUID();
  const inactiveEventId = randomUUID();
  const secondActiveEventId = randomUUID();
  const leaveEventId = randomUUID();
  const timeoutEnterEventId = randomUUID();
  const timeoutActiveEventId = randomUUID();
  const heartbeatEventId = randomUUID();
  const invalidEventId = 'invalid-uuid';
  const sessionId = randomUUID();
  const timeoutSessionId = randomUUID();
  const browserId = randomUUID();
  const rawUrl = `https://www.vnexpress.net/test/${runId}/?utm_source=e2e`;
  const canonicalUrl = `https://vnexpress.net/test/${runId}`;
  const testDomain = `${runId}.example.com`;
  const startedAt = new Date();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', {
      exclude: [{ path: 'health', method: RequestMethod.GET }],
    });
    app.useGlobalPipes(
      new ValidationPipe({ forbidNonWhitelisted: true, transform: true, whitelist: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.readingEvent.deleteMany({
      where: {
        eventId: {
          in: [
            enterEventId,
            activeEventId,
            inactiveEventId,
            secondActiveEventId,
            leaveEventId,
            timeoutEnterEventId,
            timeoutActiveEventId,
            heartbeatEventId,
          ],
        },
      },
    });
    await prisma.readingSession.deleteMany({
      where: { sessionId: { in: [sessionId, timeoutSessionId] } },
    });
    await prisma.article.deleteMany({ where: { canonicalUrl } });
    await prisma.siteConfig.deleteMany({ where: { domain: testDomain } });
    await app.close();
  });

  it('ingests a valid PAGE_ENTER while rejecting an invalid batch item', async () => {
    const response = await request(app.getHttpServer() as SupertestApp)
      .post('/api/events')
      .send({
        events: [
          {
            eventId: enterEventId,
            eventType: 'PAGE_ENTER',
            sessionId,
            sequenceNumber: 0,
            occurredAt: startedAt.toISOString(),
            url: rawUrl,
            domain: 'vnexpress.net',
            title: 'Bài viết integration test',
            content: 'Đây là nội dung bài viết dùng cho integration test.',
            browserId,
            tabId: 7,
            context: { visible: true },
          },
          { eventId: invalidEventId },
        ],
      })
      .expect(201);

    expect(response.text).toContain(enterEventId);
    expect(response.text).toContain(invalidEventId);

    const article = await prisma.article.findUniqueOrThrow({ where: { canonicalUrl } });
    expect(article.wordCount).toBe(10);
    expect(article.contentHash).toHaveLength(64);

    const session = await prisma.readingSession.findUniqueOrThrow({ where: { sessionId } });
    expect(session.articleId).toBe(article.id);
    expect(session.status).toBe(ReadingSessionStatus.ACTIVE);

    const event = await prisma.readingEvent.findUniqueOrThrow({ where: { eventId: enterEventId } });
    expect(event.receivedAt).toBeInstanceOf(Date);
  });

  it('classifies a repeated eventId as duplicated', async () => {
    const response = await request(app.getHttpServer() as SupertestApp)
      .post('/api/events')
      .send({
        events: [
          {
            eventId: enterEventId,
            eventType: 'PAGE_ENTER',
            sessionId,
            sequenceNumber: 0,
            occurredAt: new Date().toISOString(),
            url: rawUrl,
            domain: 'vnexpress.net',
            title: 'Bài viết integration test',
            browserId,
            tabId: 7,
            context: {},
          },
        ],
      })
      .expect(201);

    expect(response.text).toContain(`"duplicated":["${enterEventId}"]`);
    expect(await prisma.readingEvent.count({ where: { eventId: enterEventId } })).toBe(1);
  });

  it('recalculates multiple active intervals when events arrive late', async () => {
    await request(app.getHttpServer() as SupertestApp)
      .post('/api/events')
      .send({
        events: [
          {
            eventId: activeEventId,
            eventType: 'PAGE_ACTIVE',
            sessionId,
            sequenceNumber: 1,
            occurredAt: new Date(startedAt.getTime() + 1000).toISOString(),
            url: rawUrl,
            domain: 'vnexpress.net',
            title: 'Bài viết integration test',
            browserId,
            tabId: 7,
            context: { visible: true },
          },
        ],
      })
      .expect(201);

    await request(app.getHttpServer() as SupertestApp)
      .post('/api/events')
      .send({
        events: [
          {
            eventId: secondActiveEventId,
            eventType: 'PAGE_ACTIVE',
            sessionId,
            sequenceNumber: 3,
            occurredAt: new Date(startedAt.getTime() + 4000).toISOString(),
            url: rawUrl,
            domain: 'vnexpress.net',
            title: 'Bài viết integration test',
            browserId,
            tabId: 7,
            context: { visible: true },
          },
        ],
      })
      .expect(201);

    await request(app.getHttpServer() as SupertestApp)
      .post('/api/events')
      .send({
        events: [
          {
            eventId: inactiveEventId,
            eventType: 'PAGE_INACTIVE',
            sessionId,
            sequenceNumber: 2,
            occurredAt: new Date(startedAt.getTime() + 3000).toISOString(),
            url: rawUrl,
            domain: 'vnexpress.net',
            title: 'Bài viết integration test',
            browserId,
            tabId: 7,
            context: { visible: false },
          },
        ],
      })
      .expect(201);

    await request(app.getHttpServer() as SupertestApp)
      .post('/api/events')
      .send({
        events: [
          {
            eventId: leaveEventId,
            eventType: 'PAGE_LEAVE',
            sessionId,
            sequenceNumber: 4,
            occurredAt: new Date(startedAt.getTime() + 7000).toISOString(),
            url: rawUrl,
            domain: 'vnexpress.net',
            title: 'Bài viết integration test',
            browserId,
            tabId: 7,
            context: { visible: false },
          },
        ],
      })
      .expect(201);

    const session = await prisma.readingSession.findUniqueOrThrow({ where: { sessionId } });
    expect(session.status).toBe(ReadingSessionStatus.COMPLETED);
    expect(session.endedAt).not.toBeNull();
    expect(session.activeReadingMs).toBe(5000);
    expect(await app.get(SessionsService).recalculateActiveReadingMs(sessionId)).toBe(5000);

    const article = await prisma.article.findUniqueOrThrow({ where: { canonicalUrl } });
    await request(app.getHttpServer() as SupertestApp)
      .get(`/api/articles?search=${runId}&domain=vnexpress.net&page=1&pageSize=10`)
      .expect(200);
    await request(app.getHttpServer() as SupertestApp)
      .get(`/api/articles/${article.id}`)
      .expect(200);
    await request(app.getHttpServer() as SupertestApp)
      .get(`/api/sessions?search=${sessionId}&status=COMPLETED&domain=vnexpress.net`)
      .expect(200);
    const detailResponse = await request(app.getHttpServer() as SupertestApp)
      .get(`/api/sessions/${session.id}`)
      .expect(200);
    expect(detailResponse.text).toContain(enterEventId);
    expect(detailResponse.text).toContain(activeEventId);
    expect(detailResponse.text).toContain(inactiveEventId);
    expect(detailResponse.text).toContain(secondActiveEventId);
    expect(detailResponse.text).toContain(leaveEventId);
  });

  it('times out a stale active session at its last heartbeat', async () => {
    const enteredAt = new Date(Date.now() - 120_000);
    const heartbeatAt = new Date(enteredAt.getTime() + 10_000);
    await request(app.getHttpServer() as SupertestApp)
      .post('/api/events')
      .send({
        events: [
          {
            eventId: timeoutEnterEventId,
            eventType: 'PAGE_ENTER',
            sessionId: timeoutSessionId,
            sequenceNumber: 0,
            occurredAt: enteredAt.toISOString(),
            url: rawUrl,
            domain: 'vnexpress.net',
            title: 'Bài viết timeout test',
            browserId,
            tabId: 8,
            context: {},
          },
          {
            eventId: timeoutActiveEventId,
            eventType: 'PAGE_ACTIVE',
            sessionId: timeoutSessionId,
            sequenceNumber: 1,
            occurredAt: new Date(enteredAt.getTime() + 1000).toISOString(),
            url: rawUrl,
            domain: 'vnexpress.net',
            title: 'Bài viết timeout test',
            browserId,
            tabId: 8,
            context: {},
          },
          {
            eventId: heartbeatEventId,
            eventType: 'PAGE_HEARTBEAT',
            sessionId: timeoutSessionId,
            sequenceNumber: 2,
            occurredAt: heartbeatAt.toISOString(),
            url: rawUrl,
            domain: 'vnexpress.net',
            title: 'Bài viết timeout test',
            browserId,
            tabId: 8,
            context: {},
          },
        ],
      })
      .expect(201);

    await app.get(SessionsService).timeoutStaleSessions();
    const session = await prisma.readingSession.findUniqueOrThrow({
      where: { sessionId: timeoutSessionId },
    });
    expect(session.status).toBe(ReadingSessionStatus.TIMEOUT);
    expect(session.endedAt).toEqual(heartbeatAt);
    expect(session.activeReadingMs).toBe(9000);
  });

  it('creates, filters and updates a site configuration', async () => {
    await request(app.getHttpServer() as SupertestApp)
      .post('/api/site-configs')
      .send({
        domain: testDomain,
        articleUrlPatterns: [`^https://${testDomain}/articles/`],
        titleSelectors: ['h1'],
        contentSelectors: ['article'],
        removeSelectors: ['.advertisement'],
      })
      .expect(201);

    const config = await prisma.siteConfig.findUniqueOrThrow({ where: { domain: testDomain } });
    await request(app.getHttpServer() as SupertestApp)
      .get(`/api/site-configs?search=${runId}&status=enabled`)
      .expect(200);
    await request(app.getHttpServer() as SupertestApp)
      .put(`/api/site-configs/${config.id}`)
      .send({ enabled: false })
      .expect(200);

    const updated = await prisma.siteConfig.findUniqueOrThrow({ where: { id: config.id } });
    expect(updated.enabled).toBe(false);
  });
});
