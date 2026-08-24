'use client';

import type { ArticleListItemDto, PaginatedResponse } from '@news-tracker/contracts';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/page-state';
import { Pagination } from '../../../components/ui/pagination';
import { ArticleTable } from '../../../features/articles/article-table';
import { apiClient } from '../../../lib/api-client';

const pageSize = 10;

export default function ArticlesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [domain, setDomain] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sortBy, setSortBy] = useState('lastCollectedAt');
  const [sortOrder, setSortOrder] = useState('desc');

  const articles = useQuery({
    queryKey: ['articles', page, search, domain, status, from, to, sortBy, sortOrder],
    queryFn: () =>
      apiClient.get<PaginatedResponse<ArticleListItemDto>>('/articles', {
        page,
        pageSize,
        search,
        domain,
        status,
        from: from === '' ? undefined : new Date(`${from}T00:00:00.000Z`).toISOString(),
        to: to === '' ? undefined : new Date(`${to}T23:59:59.999Z`).toISOString(),
        sortBy,
        sortOrder,
      }),
  });
  const updateFilter = (setter: (value: string) => void, value: string) => {
    setPage(1);
    setter(value);
  };

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h1>Bài báo</h1>
          <p>Tìm kiếm và xem dữ liệu đã được Extension trích xuất.</p>
        </div>
      </div>
      <section className="filters" aria-label="Bộ lọc bài báo">
        <input
          aria-label="Tìm bài báo"
          placeholder="Tìm tiêu đề hoặc URL"
          value={search}
          onChange={(event) => updateFilter(setSearch, event.target.value)}
        />
        <input
          aria-label="Lọc domain"
          placeholder="Domain"
          value={domain}
          onChange={(event) => updateFilter(setDomain, event.target.value)}
        />
        <select
          aria-label="Lọc trạng thái"
          value={status}
          onChange={(event) => updateFilter(setStatus, event.target.value)}
        >
          <option value="">Mọi trạng thái</option>
          <option value="PENDING">PENDING</option>
          <option value="EXTRACTED">EXTRACTED</option>
          <option value="FAILED">FAILED</option>
        </select>
        <input
          aria-label="Từ ngày"
          type="date"
          value={from}
          onChange={(event) => updateFilter(setFrom, event.target.value)}
        />
        <input
          aria-label="Đến ngày"
          type="date"
          value={to}
          onChange={(event) => updateFilter(setTo, event.target.value)}
        />
        <select
          aria-label="Sắp xếp"
          value={sortBy}
          onChange={(event) => updateFilter(setSortBy, event.target.value)}
        >
          <option value="lastCollectedAt">Lần thu thập</option>
          <option value="title">Tiêu đề</option>
          <option value="wordCount">Số từ</option>
          <option value="createdAt">Ngày tạo</option>
        </select>
        <select
          aria-label="Thứ tự"
          value={sortOrder}
          onChange={(event) => updateFilter(setSortOrder, event.target.value)}
        >
          <option value="desc">Giảm dần</option>
          <option value="asc">Tăng dần</option>
        </select>
      </section>
      <section className="panel">
        {articles.isPending ? <LoadingState /> : null}
        {articles.isError ? (
          <ErrorState
            title="Không tải được bài báo"
            message={articles.error.message}
            action={() => void articles.refetch()}
          />
        ) : null}
        {articles.data?.data.length === 0 ? (
          <EmptyState
            title="Không có bài báo"
            message="Hãy đổi bộ lọc hoặc mở một bài báo bằng Extension."
          />
        ) : null}
        {articles.data !== undefined && articles.data.data.length > 0 ? (
          <ArticleTable articles={articles.data.data} />
        ) : null}
        {articles.data === undefined ? null : (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={articles.data.total}
            onChange={setPage}
          />
        )}
      </section>
    </div>
  );
}
