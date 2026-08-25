import { Injectable } from '@nestjs/common';
import { ReadingSessionStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [articleCount, sessionCount, activeSessionCount, readingAggregate, articles, sessions] =
      await this.prisma.$transaction([
        this.prisma.article.count(),
        this.prisma.readingSession.count(),
        this.prisma.readingSession.count({ where: { status: ReadingSessionStatus.ACTIVE } }),
        this.prisma.readingSession.aggregate({ _sum: { activeReadingMs: true } }),
        this.prisma.article.findMany({ orderBy: { lastCollectedAt: 'desc' }, take: 5 }),
        this.prisma.readingSession.findMany({
          include: {
            article: {
              select: { id: true, canonicalUrl: true, domain: true, title: true },
            },
            _count: { select: { events: true } },
          },
          orderBy: { startedAt: 'desc' },
          take: 5,
        }),
      ]);

    const articleAggregates =
      articles.length === 0
        ? []
        : await this.prisma.readingSession.groupBy({
            by: ['articleId'],
            where: { articleId: { in: articles.map((article) => article.id) } },
            _sum: { activeReadingMs: true },
            _max: { lastEventAt: true },
            _count: { _all: true },
          });
    const aggregateByArticle = new Map(
      articleAggregates.map((aggregate) => [aggregate.articleId, aggregate]),
    );

    return {
      articleCount,
      sessionCount,
      activeSessionCount,
      totalReadingMs: readingAggregate._sum.activeReadingMs ?? 0,
      recentArticles: articles.map((article) => {
        const aggregate = aggregateByArticle.get(article.id);
        return {
          ...article,
          totalReadingMs: aggregate?._sum.activeReadingMs ?? 0,
          lastReadAt: aggregate?._max.lastEventAt ?? null,
          sessionCount: aggregate?._count._all ?? 0,
        };
      }),
      recentSessions: sessions.map(({ _count, ...session }) => ({
        ...session,
        eventCount: _count.events,
      })),
    };
  }
}
