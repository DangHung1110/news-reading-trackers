import type { ArticleListItemDto } from '@news-tracker/contracts';
import Link from 'next/link';

import { StatusBadge } from '../../components/ui/status-badge';
import { formatDate, formatDuration } from '../../lib/format';

export function ArticleTable({ articles }: { articles: ArticleListItemDto[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Tiêu đề</th>
            <th>Domain</th>
            <th>Số từ</th>
            <th>Tổng thời gian đọc</th>
            <th>Đọc gần nhất</th>
            <th>Trích xuất</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {articles.map((article) => (
            <tr key={article.id}>
              <td className="title-cell" title={article.title}>
                {article.title || 'Chưa có tiêu đề'}
              </td>
              <td>{article.domain}</td>
              <td>{article.wordCount.toLocaleString('vi-VN')}</td>
              <td>{formatDuration(article.totalReadingMs)}</td>
              <td>{formatDate(article.lastReadAt)}</td>
              <td>
                <StatusBadge status={article.extractionStatus} />
              </td>
              <td>
                <Link className="text-link" href={`/articles/${article.id}`}>
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
