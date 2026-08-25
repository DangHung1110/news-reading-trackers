import type { ArticleListItemDto } from '@news-tracker/contracts';
import { render, screen } from '@testing-library/react';

import { ArticleTable } from './article-table';

const article: ArticleListItemDto = {
  id: 'article-1',
  canonicalUrl: 'https://vnexpress.net/test',
  domain: 'vnexpress.net',
  title: 'Một tiêu đề bài báo rất dài vẫn được render trong bảng',
  content: 'Nội dung',
  wordCount: 1250,
  summary: null,
  category: null,
  extractionStatus: 'EXTRACTED',
  firstCollectedAt: '2026-08-24T01:00:00.000Z',
  lastCollectedAt: '2026-08-24T01:00:00.000Z',
  totalReadingMs: 125000,
  lastReadAt: '2026-08-24T01:02:05.000Z',
  sessionCount: 1,
};

describe('ArticleTable', () => {
  it('renders article values and detail action', () => {
    render(<ArticleTable articles={[article]} />);

    expect(screen.getByText(article.title)).toBeInTheDocument();
    expect(screen.getByText('vnexpress.net')).toBeInTheDocument();
    expect(screen.getByText('2 phút 5 giây')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem' })).toHaveAttribute(
      'href',
      '/articles/article-1',
    );
  });
});
