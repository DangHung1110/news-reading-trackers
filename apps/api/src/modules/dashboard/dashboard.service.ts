import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, ReadingSessionStatus } from '@prisma/client';

import type { DashboardAnalyticsDto, TimeSeriesPointDto } from '@news-tracker/contracts';

import { PrismaService } from '../../prisma/prisma.service';
import type { DashboardAnalyticsQueryDto } from './dto/dashboard-analytics-query.dto';

interface TopDomainRow {
  domain: string;
}

interface TimeSeriesRow {
  label: string;
  value: bigint | number;
}

interface ActivityRow {
  label: string;
  activeMs: bigint | number;
  inactiveMs: bigint | number;
}

interface HourRow {
  hour: number;
  value: bigint | number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [
      articleCount,
      sessionCount,
      activeSessionCount,
      readingAggregate,
      articles,
      sessions,
      topDomains,
    ] = await this.prisma.$transaction([
      this.prisma.article.count(),
      this.prisma.readingSession.count(),
      this.prisma.readingSession.count({ where: { status: ReadingSessionStatus.ACTIVE } }),
      this.prisma.readingSession.aggregate({
        _sum: { activeReadingMs: true },
        _avg: { activeReadingMs: true },
      }),
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
      this.prisma.$queryRaw<TopDomainRow[]>(Prisma.sql`
          SELECT a.domain
          FROM "ReadingSession" s
          INNER JOIN "Article" a ON a.id = s."articleId"
          GROUP BY a.domain
          ORDER BY SUM(s."activeReadingMs") DESC, COUNT(s.id) DESC
          LIMIT 1
        `),
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
      averageReadingMs: Math.round(readingAggregate._avg.activeReadingMs ?? 0),
      topDomain: topDomains[0]?.domain ?? null,
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

  async getAnalytics(query: DashboardAnalyticsQueryDto): Promise<DashboardAnalyticsDto> {
    const { from, to } = this.getDateRange(query);
    const domain = query.domain?.toLowerCase();
    const sessionDomainFilter =
      domain === undefined ? Prisma.empty : Prisma.sql`AND a.domain = ${domain}`;
    const articleDomainFilter =
      domain === undefined ? Prisma.empty : Prisma.sql`AND a.domain = ${domain}`;

    const [activityRows, articleRows, domainRows, hourRows] = await Promise.all([
      this.prisma.$queryRaw<ActivityRow[]>(Prisma.sql`
        SELECT
          TO_CHAR(DATE_TRUNC('day', s."startedAt"), 'YYYY-MM-DD') AS label,
          SUM(s."activeReadingMs")::bigint AS "activeMs",
          SUM(
            GREATEST(
              (EXTRACT(EPOCH FROM (COALESCE(s."endedAt", s."lastEventAt") - s."startedAt")) * 1000)::bigint
                - s."activeReadingMs",
              0
            )
          )::bigint AS "inactiveMs"
        FROM "ReadingSession" s
        INNER JOIN "Article" a ON a.id = s."articleId"
        WHERE s."startedAt" BETWEEN ${from} AND ${to} ${sessionDomainFilter}
        GROUP BY DATE_TRUNC('day', s."startedAt")
        ORDER BY DATE_TRUNC('day', s."startedAt") ASC
      `),
      this.prisma.$queryRaw<TimeSeriesRow[]>(Prisma.sql`
        SELECT a.domain AS label, COUNT(a.id)::bigint AS value
        FROM "Article" a
        WHERE a."lastCollectedAt" BETWEEN ${from} AND ${to} ${articleDomainFilter}
        GROUP BY a.domain
        ORDER BY COUNT(a.id) DESC
        LIMIT 8
      `),
      this.prisma.$queryRaw<TimeSeriesRow[]>(Prisma.sql`
        SELECT a.domain AS label, SUM(s."activeReadingMs")::bigint AS value
        FROM "ReadingSession" s
        INNER JOIN "Article" a ON a.id = s."articleId"
        WHERE s."startedAt" BETWEEN ${from} AND ${to} ${sessionDomainFilter}
        GROUP BY a.domain
        ORDER BY SUM(s."activeReadingMs") DESC
        LIMIT 8
      `),
      this.prisma.$queryRaw<HourRow[]>(Prisma.sql`
        SELECT EXTRACT(HOUR FROM s."startedAt")::int AS hour, COUNT(s.id)::bigint AS value
        FROM "ReadingSession" s
        INNER JOIN "Article" a ON a.id = s."articleId"
        WHERE s."startedAt" BETWEEN ${from} AND ${to} ${sessionDomainFilter}
        GROUP BY EXTRACT(HOUR FROM s."startedAt")
        ORDER BY hour ASC
      `),
    ]);

    const activeInactiveByDate = activityRows.map((row) => ({
      label: row.label,
      activeMs: Number(row.activeMs),
      inactiveMs: Number(row.inactiveMs),
    }));
    const byHour = new Map(hourRows.map((row) => [row.hour, Number(row.value)]));

    return {
      readingTimeByDate: activeInactiveByDate.map(({ label, activeMs }) => ({
        label,
        value: activeMs,
      })),
      articleCountByDomain: this.toTimeSeries(articleRows),
      readingTimeByDomain: this.toTimeSeries(domainRows),
      activeInactiveByDate,
      activityByHour: Array.from({ length: 24 }, (_, hour) => ({
        label: `${String(hour).padStart(2, '0')}:00`,
        value: byHour.get(hour) ?? 0,
      })),
    };
  }

  private getDateRange(query: DashboardAnalyticsQueryDto): { from: Date; to: Date } {
    const to = query.to === undefined ? new Date() : new Date(query.to);
    const from =
      query.from === undefined
        ? new Date(to.getTime() - (query.days - 1) * 24 * 60 * 60 * 1000)
        : new Date(query.from);
    if (from > to) throw new BadRequestException('from must be earlier than or equal to to');
    return { from, to };
  }

  private toTimeSeries(rows: TimeSeriesRow[]): TimeSeriesPointDto[] {
    return rows.map((row) => ({ label: row.label, value: Number(row.value) }));
  }
}
