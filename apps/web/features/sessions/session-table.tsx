import type { ReadingSessionListItemDto } from '@news-tracker/contracts';
import Link from 'next/link';

import { StatusBadge } from '../../components/ui/status-badge';
import { formatDate, formatDuration } from '../../lib/format';

export function SessionTable({ sessions }: { sessions: ReadingSessionListItemDto[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Bài báo</th>
            <th>Bắt đầu</th>
            <th>Kết thúc</th>
            <th>Thời gian đọc</th>
            <th>Trạng thái</th>
            <th>Event</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id}>
              <td className="title-cell" title={session.article.title}>
                {session.article.title || session.article.canonicalUrl}
              </td>
              <td>{formatDate(session.startedAt)}</td>
              <td>{formatDate(session.endedAt)}</td>
              <td>{formatDuration(session.activeReadingMs)}</td>
              <td>
                <StatusBadge status={session.status} />
              </td>
              <td>{session.eventCount}</td>
              <td>
                <Link className="text-link" href={`/sessions/${session.id}`}>
                  Xem
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
