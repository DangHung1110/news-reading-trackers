import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
});
type SessionListItem = Prisma.ReadingSessionGetPayload<{ include: typeof sessionListInclude }>;

export class SessionEventError extends Error {}

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: SessionQueryDto): Promise<PaginatedResponse<SessionListItem>> {
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

    return { data, page: query.page, pageSize: query.pageSize, total };
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
    const session = await this.prisma.readingSession.findUnique({
      where: { sessionId },
      select: { id: true },
    });
    if (session === null) throw new NotFoundException('Reading session not found');

    const events = await this.prisma.readingEvent.findMany({
      where: { sessionId },
      orderBy: [{ sequenceNumber: 'asc' }, { occurredAt: 'asc' }],
      select: { eventType: true, occurredAt: true },
    });
    let activeSince: Date | null = null;
    let total = 0;

    for (const event of events) {
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

    const activeReadingMs = Math.min(total, 2_147_483_647);
    await this.prisma.readingSession.update({
      where: { id: session.id },
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

    await transaction.readingSession.update({
      where: { id: session.id },
      data: {
        lastEventAt,
        endedAt: closing ? occurredAt : undefined,
        status: closing ? ReadingSessionStatus.COMPLETED : undefined,
      },
    });
  }
}
