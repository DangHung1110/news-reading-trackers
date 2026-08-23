import { ExtractionStatus } from '@prisma/client';
import { IsEnum, IsFQDN, IsIn, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const ARTICLE_SORT_FIELDS = ['createdAt', 'lastCollectedAt', 'title', 'wordCount'] as const;
export type ArticleSortField = (typeof ARTICLE_SORT_FIELDS)[number];

export class ArticleQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsFQDN()
  domain?: string;

  @IsOptional()
  @IsEnum(ExtractionStatus)
  status?: ExtractionStatus;

  @IsOptional()
  @IsIn(ARTICLE_SORT_FIELDS)
  sortBy: ArticleSortField = 'lastCollectedAt';
}
