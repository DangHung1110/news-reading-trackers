import { IsFQDN, IsIn, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const SITE_CONFIG_STATUSES = ['enabled', 'disabled'] as const;
const SITE_CONFIG_SORT_FIELDS = ['createdAt', 'updatedAt', 'domain'] as const;
type SiteConfigStatus = (typeof SITE_CONFIG_STATUSES)[number];
type SiteConfigSortField = (typeof SITE_CONFIG_SORT_FIELDS)[number];

export class SiteConfigQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsFQDN()
  domain?: string;

  @IsOptional()
  @IsIn(SITE_CONFIG_STATUSES)
  status?: SiteConfigStatus;

  @IsOptional()
  @IsIn(SITE_CONFIG_SORT_FIELDS)
  sortBy: SiteConfigSortField = 'domain';
}
