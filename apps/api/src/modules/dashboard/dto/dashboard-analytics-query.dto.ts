import { Type } from 'class-transformer';
import { IsFQDN, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

export class DashboardAnalyticsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days = 30;

  @IsOptional()
  @IsFQDN()
  domain?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}
