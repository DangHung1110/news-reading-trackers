import type { ReadingSessionListItemDto } from '@news-tracker/contracts';
import { render, screen } from '@testing-library/react';

import { SessionTable } from './session-table';

const session: ReadingSessionListItemDto = {
  id: 'db-session-1',
  sessionId: 'session-1',
  browserId: 'browser-1',
  tabId: 4,
  articleId: 'article-1',
  startedAt: '2026-08-24T01:00:00.000Z',
  endedAt: '2026-08-24T01:01:30.000Z',
  activeReadingMs: 90000,
  status: 'COMPLETED',
  lastEventAt: '2026-08-24T01:01:30.000Z',
  article: {
    id: 'article-1',
    canonicalUrl: 'https://dantri.com.vn/test',
    domain: 'dantri.com.vn',
    title: 'Bài báo kiểm thử',
  },
  eventCount: 5,
};

describe('SessionTable', () => {
  it('renders session duration, status and event count', () => {
    render(<SessionTable sessions={[session]} />);

    expect(screen.getByText('Bài báo kiểm thử')).toBeInTheDocument();
    expect(screen.getByText('1 phút 30 giây')).toBeInTheDocument();
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
