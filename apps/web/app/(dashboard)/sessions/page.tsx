'use client';

import type { PaginatedResponse, ReadingSessionListItemDto } from '@news-tracker/contracts';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/page-state';
import { Pagination } from '../../../components/ui/pagination';
import { SessionTable } from '../../../features/sessions/session-table';
import { apiClient } from '../../../lib/api-client';

const pageSize = 10;

export default function SessionsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [domain, setDomain] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sortBy, setSortBy] = useState('startedAt');
  const [sortOrder, setSortOrder] = useState('desc');

  const sessions = useQuery({
    queryKey: ['sessions', page, search, domain, status, from, to, sortBy, sortOrder],
    queryFn: () =>
      apiClient.get<PaginatedResponse<ReadingSessionListItemDto>>('/sessions', {
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
          <h1>Phiên đọc</h1>
          <p>Theo dõi thời gian active và trạng thái từng phiên đọc.</p>
        </div>
      </div>
      <section className="filters" aria-label="Bộ lọc phiên đọc">
        <input
          aria-label="Tìm phiên đọc"
          placeholder="Tìm bài báo hoặc session ID"
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
          <option value="ACTIVE">ACTIVE</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="ABANDONED">ABANDONED</option>
          <option value="TIMEOUT">TIMEOUT</option>
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
          <option value="startedAt">Bắt đầu</option>
          <option value="lastEventAt">Event gần nhất</option>
          <option value="activeReadingMs">Thời gian đọc</option>
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
        {sessions.isPending ? <LoadingState /> : null}
        {sessions.isError ? (
          <ErrorState
            title="Không tải được phiên đọc"
            message={sessions.error.message}
            action={() => void sessions.refetch()}
          />
        ) : null}
        {sessions.data?.data.length === 0 ? (
          <EmptyState
            title="Không có phiên đọc"
            message="Hãy mở và đọc một bài báo bằng Extension."
          />
        ) : null}
        {sessions.data !== undefined && sessions.data.data.length > 0 ? (
          <SessionTable sessions={sessions.data.data} />
        ) : null}
        {sessions.data === undefined ? null : (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={sessions.data.total}
            onChange={setPage}
          />
        )}
      </section>
    </div>
  );
}
