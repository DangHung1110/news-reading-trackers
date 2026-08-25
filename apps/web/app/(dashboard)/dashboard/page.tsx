'use client';

import type { DashboardAnalyticsDto, DashboardSummaryDto } from '@news-tracker/contracts';
import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

import { ErrorState, LoadingState } from '../../../components/ui/page-state';
import { ArticleTable } from '../../../features/articles/article-table';
import { ActivityChart, BarChart, DonutChart, LineChart } from '../../../features/dashboard/charts';
import { SessionTable } from '../../../features/sessions/session-table';
import { apiClient } from '../../../lib/api-client';
import { formatDuration } from '../../../lib/format';

export default function DashboardPage() {
  const [days, setDays] = useState(30);
  const [domainInput, setDomainInput] = useState('');
  const [domain, setDomain] = useState('');
  const summary = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiClient.get<DashboardSummaryDto>('/dashboard'),
  });
  const analytics = useQuery({
    queryKey: ['dashboard-analytics', days, domain],
    queryFn: () =>
      apiClient.get<DashboardAnalyticsDto>('/dashboard/analytics', {
        days,
        domain,
      }),
  });
  const applyDomain = (event: FormEvent) => {
    event.preventDefault();
    setDomain(domainInput.trim().toLowerCase());
  };

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
        <form className="analytics-filter" onSubmit={applyDomain}>
          <select
            aria-label="Khoảng thời gian analytics"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
          >
            <option value={7}>7 ngày</option>
            <option value={30}>30 ngày</option>
            <option value={90}>90 ngày</option>
            <option value={365}>365 ngày</option>
          </select>
          <input
            aria-label="Domain analytics"
            placeholder="Tất cả domain"
            value={domainInput}
            onChange={(event) => setDomainInput(event.target.value)}
          />
          <button className="button secondary" type="submit">
            Lọc
          </button>
        </form>
      </div>
      <section className="metrics analytics-metrics" aria-label="Chỉ số tổng quan">
        <article className="metric-card">
          <span>Bài báo</span>
          <strong>{data.articleCount}</strong>
        </article>
        <article className="metric-card">
          <span>Thời gian trung bình</span>
          <strong>{formatDuration(data.averageReadingMs)}</strong>
        </article>
        <article className="metric-card">
          <span>Đang active</span>
          <strong>{data.activeSessionCount}</strong>
        </article>
        <article className="metric-card">
          <span>Tổng thời gian đọc</span>
          <strong>{formatDuration(data.totalReadingMs)}</strong>
        </article>
        <article className="metric-card">
          <span>Domain đọc nhiều nhất</span>
          <strong>{data.topDomain ?? '—'}</strong>
        </article>
      </section>
      {analytics.isPending ? <LoadingState message="Đang tải biểu đồ…" /> : null}
      {analytics.isError ? (
        <ErrorState
          title="Không tải được analytics"
          message={analytics.error.message}
          action={() => void analytics.refetch()}
        />
      ) : null}
      {analytics.data === undefined ? null : (
        <section className="chart-grid" aria-label="Biểu đồ analytics">
          <article className="panel chart-panel chart-wide">
            <div className="panel-heading">
              <h2>Thời gian đọc theo ngày</h2>
            </div>
            {analytics.data.readingTimeByDate.length === 0 ? (
              <p className="inline-empty">Chưa có dữ liệu.</p>
            ) : (
              <LineChart data={analytics.data.readingTimeByDate} formatValue={formatDuration} />
            )}
          </article>
          <article className="panel chart-panel">
            <div className="panel-heading">
              <h2>Số bài theo domain</h2>
            </div>
            {analytics.data.articleCountByDomain.length === 0 ? (
              <p className="inline-empty">Chưa có dữ liệu.</p>
            ) : (
              <BarChart data={analytics.data.articleCountByDomain} />
            )}
          </article>
          <article className="panel chart-panel">
            <div className="panel-heading">
              <h2>Tỷ lệ thời gian theo domain</h2>
            </div>
            <DonutChart data={analytics.data.readingTimeByDomain} formatValue={formatDuration} />
          </article>
          <article className="panel chart-panel">
            <div className="panel-heading">
              <h2>Active và inactive</h2>
            </div>
            {analytics.data.activeInactiveByDate.length === 0 ? (
              <p className="inline-empty">Chưa có dữ liệu.</p>
            ) : (
              <ActivityChart data={analytics.data.activeInactiveByDate} />
            )}
          </article>
          <article className="panel chart-panel chart-wide">
            <div className="panel-heading">
              <h2>Hoạt động theo giờ</h2>
            </div>
            <BarChart data={analytics.data.activityByHour} />
          </article>
        </section>
      )}
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
