'use client';

import type { ArticleDetailDto } from '@news-tracker/contracts';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { ErrorState, LoadingState } from '../../components/ui/page-state';
import { StatusBadge } from '../../components/ui/status-badge';
import { apiClient } from '../../lib/api-client';
import { formatDate, formatDuration } from '../../lib/format';

export function ArticleDetail({ id }: { id: string }) {
  const article = useQuery({
    queryKey: ['article', id],
    queryFn: () => apiClient.get<ArticleDetailDto>(`/articles/${id}`),
  });

  if (article.isPending) return <LoadingState />;
  if (article.isError) {
    return (
      <ErrorState
        title="Không tải được bài báo"
        message={article.error.message}
        action={() => void article.refetch()}
      />
    );
  }

  const data = article.data;
  return (
    <div className="page-stack">
      <div className="page-heading detail-heading">
        <div>
          <Link className="back-link" href="/articles">
            ← Danh sách bài báo
          </Link>
          <h1>{data.title || 'Chưa có tiêu đề'}</h1>
          <a className="external-url" href={data.canonicalUrl} target="_blank" rel="noreferrer">
            {data.canonicalUrl}
          </a>
        </div>
        <StatusBadge status={data.extractionStatus} />
      </div>
      <section className="detail-grid">
        <article className="metric-card">
          <span>Domain</span>
          <strong>{data.domain}</strong>
        </article>
        <article className="metric-card">
          <span>Số từ</span>
          <strong>{data.wordCount.toLocaleString('vi-VN')}</strong>
        </article>
        <article className="metric-card">
          <span>Tổng thời gian đọc</span>
          <strong>{formatDuration(data.totalReadingMs)}</strong>
        </article>
        <article className="metric-card">
          <span>Tóm tắt</span>
          <strong>{data.summary === null ? 'Chưa có' : 'Đã có'}</strong>
        </article>
      </section>
      <section className="panel article-content">
        <div className="panel-heading">
          <h2>Nội dung</h2>
        </div>
        <div className="article-body">{data.content || 'Nội dung chưa được trích xuất.'}</div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Phiên đọc liên quan ({data.sessionCount})</h2>
        </div>
        {data.readingSessions.length === 0 ? (
          <p className="inline-empty">Chưa có phiên đọc.</p>
        ) : (
          <div className="related-list">
            {data.readingSessions.map((session) => (
              <Link href={`/sessions/${session.id}`} key={session.id}>
                <span>{formatDate(session.startedAt)}</span>
                <strong>{formatDuration(session.activeReadingMs)}</strong>
                <StatusBadge status={session.status} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
