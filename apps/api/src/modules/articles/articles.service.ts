import { createHash } from 'node:crypto';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ExtractionStatus, Prisma, type Article } from '@prisma/client';

import type { ArticleListItemDto, PaginatedResponse } from '@news-tracker/contracts';
import type { ValidatedReadingEvent } from '@news-tracker/validation';

import { PrismaService } from '../../prisma/prisma.service';
import type { ArticleQueryDto } from './dto/article-query.dto';

const TRACKING_PARAMETERS = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'mc_cid',
  'mc_eid',
  'ref',
  'referrer',
]);

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ArticleQueryDto): Promise<PaginatedResponse<ArticleListItemDto>> {
    if (
      query.from !== undefined &&
      query.to !== undefined &&
      new Date(query.from).getTime() > new Date(query.to).getTime()
    ) {
      throw new BadRequestException('from must be earlier than or equal to to');
    }
    const collectedAt: Prisma.DateTimeFilter = {};
    if (query.from !== undefined) collectedAt.gte = new Date(query.from);
    if (query.to !== undefined) collectedAt.lte = new Date(query.to);

    const where: Prisma.ArticleWhereInput = {
      domain: query.domain?.toLowerCase(),
      extractionStatus: query.status,
      lastCollectedAt: Object.keys(collectedAt).length > 0 ? collectedAt : undefined,
      OR:
        query.search === undefined
          ? undefined
          : [
              { title: { contains: query.search, mode: 'insensitive' } },
              { canonicalUrl: { contains: query.search, mode: 'insensitive' } },
              { content: { contains: query.search, mode: 'insensitive' } },
            ],
    };
    const skip = (query.page - 1) * query.pageSize;
    const orderBy = {
      [query.sortBy]: query.sortOrder,
    } satisfies Prisma.ArticleOrderByWithRelationInput;
    const [articles, total] = await this.prisma.$transaction([
      this.prisma.article.findMany({ where, orderBy, skip, take: query.pageSize }),
      this.prisma.article.count({ where }),
    ]);

    const aggregates = await this.getSessionAggregates(articles.map((article) => article.id));
    const data = articles.map((article) => this.toListItem(article, aggregates.get(article.id)));

    return { data, page: query.page, pageSize: query.pageSize, total };
  }

  async findOne(id: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      include: {
        readingSessions: {
          include: { article: true, _count: { select: { events: true } } },
          orderBy: { startedAt: 'desc' },
        },
      },
    });
    if (article === null) throw new NotFoundException('Article not found');
    const aggregates = await this.getSessionAggregates([article.id]);
    const { readingSessions, ...articleData } = article;
    return {
      ...this.toListItem(articleData, aggregates.get(article.id)),
      readingSessions: readingSessions.map(({ _count, ...session }) => ({
        ...session,
        eventCount: _count.events,
      })),
    };
  }

  async upsertFromEvent(
    transaction: Prisma.TransactionClient,
    event: ValidatedReadingEvent,
  ): Promise<Article> {
    const canonicalUrl = this.normalizeUrl(event.canonicalUrl ?? event.url);
    const domain = new URL(canonicalUrl).hostname;
    const content = event.content?.trim() ?? '';
    const contentHash = this.hashContent(content);
    const wordCount = this.countWords(content);
    const now = new Date();
    const update: Prisma.ArticleUpdateInput = {
      domain,
      title: event.title,
      lastCollectedAt: now,
    };

    if (content.length > 0) {
      update.content = content;
      update.contentHash = contentHash;
      update.wordCount = wordCount;
      update.extractionStatus = ExtractionStatus.EXTRACTED;
    }

    return transaction.article.upsert({
      where: { canonicalUrl },
      create: {
        canonicalUrl,
        domain,
        title: event.title,
        content,
        contentHash,
        wordCount,
        extractionStatus:
          content.length > 0 ? ExtractionStatus.EXTRACTED : ExtractionStatus.PENDING,
        firstCollectedAt: now,
        lastCollectedAt: now,
      },
      update,
    });
  }

  normalizeUrl(input: string): string {
    const url = new URL(input);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./u, '');
    url.pathname = url.pathname.replace(/\/{2,}/gu, '/');
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/$/u, '');

    for (const parameter of [...url.searchParams.keys()]) {
      const normalizedParameter = parameter.toLowerCase();
      if (normalizedParameter.startsWith('utm_') || TRACKING_PARAMETERS.has(normalizedParameter)) {
        url.searchParams.delete(parameter);
      }
    }
    url.searchParams.sort();

    return url.toString();
  }

  hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  countWords(content: string): number {
    const normalized = content.trim();
    return normalized.length === 0 ? 0 : normalized.split(/\s+/u).length;
  }

  private async getSessionAggregates(articleIds: string[]) {
    if (articleIds.length === 0) return new Map<string, SessionAggregate>();
    const aggregates = await this.prisma.readingSession.groupBy({
      by: ['articleId'],
      where: { articleId: { in: articleIds } },
      _sum: { activeReadingMs: true },
      _max: { lastEventAt: true },
      _count: { _all: true },
    });
    return new Map(
      aggregates.map((aggregate) => [
        aggregate.articleId,
        {
          totalReadingMs: aggregate._sum.activeReadingMs ?? 0,
          lastReadAt: aggregate._max.lastEventAt,
          sessionCount: aggregate._count._all,
        },
      ]),
    );
  }

  private toListItem(article: Article, aggregate?: SessionAggregate): ArticleListItemDto {
    return {
      ...article,
      firstCollectedAt: article.firstCollectedAt.toISOString(),
      lastCollectedAt: article.lastCollectedAt.toISOString(),
      totalReadingMs: aggregate?.totalReadingMs ?? 0,
      lastReadAt: aggregate?.lastReadAt?.toISOString() ?? null,
      sessionCount: aggregate?.sessionCount ?? 0,
    };
  }
}

interface SessionAggregate {
  totalReadingMs: number;
  lastReadAt: Date | null;
  sessionCount: number;
}
