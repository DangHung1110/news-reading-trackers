'use client';

import type { PaginatedResponse, SiteConfigDto } from '@news-tracker/contracts';
import { useQuery } from '@tanstack/react-query';

import { EmptyState, ErrorState, LoadingState } from '../../../../components/ui/page-state';
import { CreateSiteConfig } from '../../../../features/sites/create-site-config';
import { SiteConfigCard } from '../../../../features/sites/site-config-card';
import { apiClient } from '../../../../lib/api-client';

export default function SiteSettingsPage() {
  const configs = useQuery({
    queryKey: ['site-configs'],
    queryFn: () =>
      apiClient.get<PaginatedResponse<SiteConfigDto>>('/site-configs', {
        pageSize: 100,
        sortBy: 'domain',
        sortOrder: 'asc',
      }),
  });

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h1>Cấu hình website</h1>
          <p>Quản lý URL pattern và selector phục vụ Extension.</p>
        </div>
        <CreateSiteConfig />
      </div>
      {configs.isPending ? <LoadingState /> : null}
      {configs.isError ? (
        <ErrorState
          title="Không tải được cấu hình"
          message={configs.error.message}
          action={() => void configs.refetch()}
        />
      ) : null}
      {configs.data?.data.length === 0 ? (
        <EmptyState
          title="Chưa có website"
          message="Tạo cấu hình website đầu tiên để Extension nhận diện bài báo."
        />
      ) : null}
      <div className="site-list">
        {configs.data?.data.map((config) => (
          <SiteConfigCard config={config} key={config.id} />
        ))}
      </div>
    </div>
  );
}
