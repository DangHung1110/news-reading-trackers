import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type SiteConfig } from '@prisma/client';

import type { PaginatedResponse, SiteConfigDto } from '@news-tracker/contracts';

import { PrismaService } from '../../prisma/prisma.service';
import type { CreateSiteConfigDto } from './dto/create-site-config.dto';
import type { SiteConfigQueryDto } from './dto/site-config-query.dto';
import type { UpdateSiteConfigDto } from './dto/update-site-config.dto';

@Injectable()
export class SiteConfigsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: SiteConfigQueryDto): Promise<PaginatedResponse<SiteConfigDto>> {
    if (
      query.from !== undefined &&
      query.to !== undefined &&
      new Date(query.from).getTime() > new Date(query.to).getTime()
    ) {
      throw new BadRequestException('from must be earlier than or equal to to');
    }
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.from !== undefined) createdAt.gte = new Date(query.from);
    if (query.to !== undefined) createdAt.lte = new Date(query.to);

    const where: Prisma.SiteConfigWhereInput = {
      domain: query.domain?.toLowerCase(),
      enabled: query.status === undefined ? undefined : query.status === 'enabled',
      createdAt: Object.keys(createdAt).length > 0 ? createdAt : undefined,
      AND:
        query.search === undefined
          ? undefined
          : { domain: { contains: query.search, mode: 'insensitive' } },
    };
    const skip = (query.page - 1) * query.pageSize;
    const orderBy = {
      [query.sortBy]: query.sortOrder,
    } satisfies Prisma.SiteConfigOrderByWithRelationInput;
    const [configs, total] = await this.prisma.$transaction([
      this.prisma.siteConfig.findMany({ where, orderBy, skip, take: query.pageSize }),
      this.prisma.siteConfig.count({ where }),
    ]);

    return {
      data: configs.map((config) => this.toDto(config)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async create(input: CreateSiteConfigDto): Promise<SiteConfigDto> {
    this.validatePatterns(input.articleUrlPatterns);

    try {
      const config = await this.prisma.siteConfig.create({
        data: {
          domain: this.normalizeDomain(input.domain),
          enabled: input.enabled ?? true,
          articleUrlPatterns: input.articleUrlPatterns,
          titleSelectors: input.titleSelectors,
          contentSelectors: input.contentSelectors,
          removeSelectors: input.removeSelectors,
        },
      });
      return this.toDto(config);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A configuration for this domain already exists');
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateSiteConfigDto): Promise<SiteConfigDto> {
    if (Object.keys(input).length === 0) {
      throw new BadRequestException('At least one field must be provided');
    }
    if (input.articleUrlPatterns !== undefined) this.validatePatterns(input.articleUrlPatterns);
    const existing = await this.prisma.siteConfig.findUnique({
      where: { id },
      select: { id: true },
    });
    if (existing === null) throw new NotFoundException('Site configuration not found');

    const config = await this.prisma.siteConfig.update({
      where: { id },
      data: {
        enabled: input.enabled,
        articleUrlPatterns: input.articleUrlPatterns,
        titleSelectors: input.titleSelectors,
        contentSelectors: input.contentSelectors,
        removeSelectors: input.removeSelectors,
      },
    });
    return this.toDto(config);
  }

  private normalizeDomain(domain: string): string {
    return domain
      .trim()
      .toLowerCase()
      .replace(/^www\./u, '');
  }

  private validatePatterns(patterns: string[]): void {
    for (const pattern of patterns) {
      try {
        new RegExp(pattern, 'u');
      } catch {
        throw new BadRequestException(`Invalid article URL pattern: ${pattern}`);
      }
    }
  }

  private toDto(config: SiteConfig): SiteConfigDto {
    return {
      id: config.id,
      domain: config.domain,
      enabled: config.enabled,
      articleUrlPatterns: this.toStringArray(config.articleUrlPatterns),
      titleSelectors: this.toStringArray(config.titleSelectors),
      contentSelectors: this.toStringArray(config.contentSelectors),
      removeSelectors: this.toStringArray(config.removeSelectors),
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    };
  }

  private toStringArray(value: Prisma.JsonValue): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }
}
