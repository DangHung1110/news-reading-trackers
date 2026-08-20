import { ReadingSessionStatus } from '@prisma/client';
import { IsEnum, IsFQDN, IsIn, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const SESSION_SORT_FIELDS = ['startedAt', 'lastEventAt', 'activeReadingMs'] as const;
export type SessionSortField = (typeof SESSION_SORT_FIELDS)[number];

export class SessionQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsFQDN()
  domain?: string;

  @IsOptional()
  @IsEnum(ReadingSessionStatus)
  status?: ReadingSessionStatus;

  @IsOptional()
  @IsIn(SESSION_SORT_FIELDS)
  sortBy: SessionSortField = 'startedAt';
}
