import {
  BadRequestException,
  Injectable,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  Prisma,
  ReadingEventType,
  ReadingSessionStatus,
  type ReadingSession,
} from '@prisma/client';

import type { PaginatedResponse } from '@news-tracker/contracts';
import type { ValidatedReadingEvent } from '@news-tracker/validation';

import { PrismaService } from '../../prisma/prisma.service';
import type { SessionQueryDto } from './dto/session-query.dto';

const sessionListInclude = Prisma.validator<Prisma.ReadingSessionInclude>()({
  article: {
    select: { id: true, canonicalUrl: true, domain: true, title: true },
  },
  _count: { select: { events: true } },
});
type SessionListItem = Prisma.ReadingSessionGetPayload<{ include: typeof sessionListInclude }>;
type SessionListResponseItem = Omit<SessionListItem, '_count'> & { eventCount: number };
interface ActiveTimeEvent {
  eventType: ReadingEventType;
  occurredAt: Date;
  sequenceNumber: number;
}

export class SessionEventError extends Error {}
export const SESSION_TIMEOUT_MS = 45_000;
const SESSION_CLEANUP_INTERVAL_MS = 30_000;

@Injectable()
export class SessionsService implements OnModuleInit, OnModuleDestroy {
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.cleanupTimer = setInterval(() => {
      void this.timeoutStaleSessions().catch(() => undefined);
    }, SESSION_CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer !== null) clearInterval(this.cleanupTimer);
  }

  async findAll(query: SessionQueryDto): Promise<PaginatedResponse<SessionListResponseItem>> {
    if (
      query.from !== undefined &&
      query.to !== undefined &&
      new Date(query.from).getTime() > new Date(query.to).getTime()
    ) {
      throw new BadRequestException('from must be earlier than or equal to to');
    }
    const startedAt: Prisma.DateTimeFilter = {};
    if (query.from !== undefined) startedAt.gte = new Date(query.from);
    if (query.to !== undefined) startedAt.lte = new Date(query.to);

    const where: Prisma.ReadingSessionWhereInput = {
      status: query.status,
      startedAt: Object.keys(startedAt).length > 0 ? startedAt : undefined,
      article: query.domain === undefined ? undefined : { domain: query.domain.toLowerCase() },
      OR:
        query.search === undefined
          ? undefined
          : [
              { sessionId: { contains: query.search, mode: 'insensitive' } },
              { browserId: { contains: query.search, mode: 'insensitive' } },
              { article: { title: { contains: query.search, mode: 'insensitive' } } },
              { article: { canonicalUrl: { contains: query.search, mode: 'insensitive' } } },
            ],
    };
    const skip = (query.page - 1) * query.pageSize;
    const orderBy = {
      [query.sortBy]: query.sortOrder,
    } satisfies Prisma.ReadingSessionOrderByWithRelationInput;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.readingSession.findMany({
        where,
        include: sessionListInclude,
        orderBy,
        skip,
        take: query.pageSize,
      }),
      this.prisma.readingSession.count({ where }),
    ]);

    return {
      data: data.map(({ _count, ...session }) => ({
        ...session,
        eventCount: _count.events,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async findOne(id: string) {
    const session = await this.prisma.readingSession.findUnique({
      where: { id },
      include: {
        article: true,
        events: { orderBy: [{ sequenceNumber: 'asc' }, { occurredAt: 'asc' }] },
      },
    });
    if (session === null) throw new NotFoundException('Reading session not found');
    return session;
  }

  async recalculateActiveReadingMs(sessionId: string): Promise<number> {
    return this.prisma.$transaction(async (transaction) => {
      const session = await transaction.readingSession.findUnique({
        where: { sessionId },
        select: { id: true },
      });
      if (session === null) throw new NotFoundException('Reading session not found');
      return this.recalculateInTransaction(transaction, sessionId, session.id);
    });
  }

  async timeoutStaleSessions(referenceTime = new Date()): Promise<number> {
    const cutoff = new Date(referenceTime.getTime() - SESSION_TIMEOUT_MS);
    const staleSessions = await this.prisma.readingSession.findMany({
      where: { status: ReadingSessionStatus.ACTIVE, lastEventAt: { lte: cutoff } },
      select: { id: true, lastEventAt: true },
    });
    if (staleSessions.length === 0) return 0;

    const results = await this.prisma.$transaction(
      staleSessions.map((session) =>
        this.prisma.readingSession.updateMany({
          where: {
            id: session.id,
            status: ReadingSessionStatus.ACTIVE,
            lastEventAt: { lte: cutoff },
          },
          data: {
            status: ReadingSessionStatus.TIMEOUT,
            endedAt: session.lastEventAt,
          },
        }),
      ),
    );
    return results.reduce((total, result) => total + result.count, 0);
  }

  async recalculateInTransaction(
    transaction: Prisma.TransactionClient,
    sessionId: string,
    sessionDatabaseId: string,
  ): Promise<number> {
    const events = await transaction.readingEvent.findMany({
      where: { sessionId },
      orderBy: [{ sequenceNumber: 'asc' }, { occurredAt: 'asc' }],
      select: { eventType: true, occurredAt: true, sequenceNumber: true },
    });
    const activeReadingMs = calculateActiveReadingMs(events);

    await transaction.readingSession.update({
      where: { id: sessionDatabaseId },
      data: { activeReadingMs },
    });
    return activeReadingMs;
  }

  async ensureForEvent(
    transaction: Prisma.TransactionClient,
    event: ValidatedReadingEvent,
    articleId?: string,
  ): Promise<ReadingSession> {
    const existing = await transaction.readingSession.findUnique({
      where: { sessionId: event.sessionId },
    });

    if (existing !== null) {
      if (articleId !== undefined && existing.articleId !== articleId) {
        throw new SessionEventError('Session already belongs to another article');
      }
      return existing;
    }

    if (event.eventType !== ReadingEventType.PAGE_ENTER || articleId === undefined) {
      throw new SessionEventError('PAGE_ENTER must be accepted before other session events');
    }

    const occurredAt = new Date(event.occurredAt);
    return transaction.readingSession.create({
      data: {
        sessionId: event.sessionId,
        browserId: event.browserId,
        tabId: event.tabId,
        articleId,
        startedAt: occurredAt,
        lastEventAt: occurredAt,
      },
    });
  }

  async applyEvent(
    transaction: Prisma.TransactionClient,
    session: ReadingSession,
    event: ValidatedReadingEvent,
  ): Promise<void> {
    const occurredAt = new Date(event.occurredAt);
    const lastEventAt = occurredAt > session.lastEventAt ? occurredAt : session.lastEventAt;
    const closing = event.eventType === ReadingEventType.PAGE_LEAVE;
    const reopening =
      event.eventType === ReadingEventType.PAGE_ACTIVE &&
      session.status === ReadingSessionStatus.TIMEOUT &&
      occurredAt > session.lastEventAt;

    await transaction.readingSession.update({
      where: { id: session.id },
      data: {
        lastEventAt,
        endedAt: closing ? occurredAt : reopening ? null : undefined,
        status: closing
          ? ReadingSessionStatus.COMPLETED
          : reopening
            ? ReadingSessionStatus.ACTIVE
            : undefined,
      },
    });
  }
}

export function calculateActiveReadingMs(events: readonly ActiveTimeEvent[]): number {
  let activeSince: Date | null = null;
  let total = 0;
  const orderedEvents = [...events].sort(
    (left, right) =>
      left.sequenceNumber - right.sequenceNumber ||
      left.occurredAt.getTime() - right.occurredAt.getTime(),
  );
  let lastConfirmedAt: Date | null = null;

  for (const event of orderedEvents) {
    lastConfirmedAt = event.occurredAt;
    if (event.eventType === ReadingEventType.PAGE_ACTIVE && activeSince === null) {
      activeSince = event.occurredAt;
    }
    if (
      activeSince !== null &&
      (event.eventType === ReadingEventType.PAGE_INACTIVE ||
        event.eventType === ReadingEventType.PAGE_LEAVE)
    ) {
      total += Math.max(0, event.occurredAt.getTime() - activeSince.getTime());
      activeSince = null;
    }
  }

  if (activeSince !== null && lastConfirmedAt !== null) {
    total += Math.max(0, lastConfirmedAt.getTime() - activeSince.getTime());
  }

  return Math.min(total, 2_147_483_647);
}
