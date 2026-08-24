'use client';

import type { DashboardSummaryDto } from '@news-tracker/contracts';
import { useQuery } from '@tanstack/react-query';

import { ErrorState, LoadingState } from '../../../components/ui/page-state';
import { ArticleTable } from '../../../features/articles/article-table';
import { SessionTable } from '../../../features/sessions/session-table';
import { apiClient } from '../../../lib/api-client';
import { formatDuration } from '../../../lib/format';

export default function DashboardPage() {
  const summary = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiClient.get<DashboardSummaryDto>('/dashboard'),
  });

  if (summary.isPending) return <LoadingState />;
  if (summary.isError) {
    return (
      <ErrorState
        title="Không tải được dashboard"
        message={summary.error.message}
        action={() => void summary.refetch()}
      />
    );
  }

  const data = summary.data;
  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h1>Tổng quan hoạt động đọc</h1>
          <p>Dữ liệu articles và sessions được tổng hợp từ Central Server.</p>
        </div>
      </div>
      <section className="metrics" aria-label="Chỉ số tổng quan">
        <article className="metric-card">
          <span>Bài báo</span>
          <strong>{data.articleCount}</strong>
        </article>
        <article className="metric-card">
          <span>Phiên đọc</span>
          <strong>{data.sessionCount}</strong>
        </article>
        <article className="metric-card">
          <span>Đang active</span>
          <strong>{data.activeSessionCount}</strong>
        </article>
        <article className="metric-card">
          <span>Tổng thời gian đọc</span>
          <strong>{formatDuration(data.totalReadingMs)}</strong>
        </article>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Bài báo gần đây</h2>
        </div>
        {data.recentArticles.length === 0 ? (
          <p className="inline-empty">Chưa có bài báo.</p>
        ) : (
          <ArticleTable articles={data.recentArticles} />
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Phiên đọc gần đây</h2>
        </div>
        {data.recentSessions.length === 0 ? (
          <p className="inline-empty">Chưa có phiên đọc.</p>
        ) : (
          <SessionTable sessions={data.recentSessions} />
        )}
      </section>
    </div>
  );
}
