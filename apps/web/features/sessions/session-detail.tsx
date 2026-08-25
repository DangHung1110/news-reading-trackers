'use client';

import type { ReadingSessionDetailDto } from '@news-tracker/contracts';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { ErrorState, LoadingState } from '../../components/ui/page-state';
import { StatusBadge } from '../../components/ui/status-badge';
import { apiClient } from '../../lib/api-client';
import { formatDate, formatDuration } from '../../lib/format';
import { EventTimeline } from './event-timeline';

export function SessionDetail({ id }: { id: string }) {
  const session = useQuery({
    queryKey: ['session', id],
    queryFn: () => apiClient.get<ReadingSessionDetailDto>(`/sessions/${id}`),
  });

  if (session.isPending) return <LoadingState />;
  if (session.isError) {
    return (
      <ErrorState
        title="Không tải được phiên đọc"
        message={session.error.message}
        action={() => void session.refetch()}
      />
    );
  }

  const data = session.data;
  return (
    <div className="page-stack">
      <div className="page-heading detail-heading">
        <div>
          <Link className="back-link" href="/sessions">
            ← Danh sách phiên đọc
          </Link>
          <h1>{data.article.title || 'Phiên đọc'}</h1>
          <span className="muted-id">Session: {data.sessionId}</span>
        </div>
        <StatusBadge status={data.status} />
      </div>
      <section className="detail-grid">
        <article className="metric-card">
          <span>Bắt đầu</span>
          <strong>{formatDate(data.startedAt)}</strong>
        </article>
        <article className="metric-card">
          <span>Kết thúc</span>
          <strong>{formatDate(data.endedAt)}</strong>
        </article>
        <article className="metric-card">
          <span>Active reading</span>
          <strong>{formatDuration(data.activeReadingMs)}</strong>
        </article>
        <article className="metric-card">
          <span>Số event</span>
          <strong>{data.events.length}</strong>
        </article>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Event timeline</h2>
        </div>
        {data.events.length === 0 ? (
          <p className="inline-empty">Phiên chưa có event.</p>
        ) : (
          <EventTimeline events={data.events} />
        )}
      </section>
    </div>
  );
}
