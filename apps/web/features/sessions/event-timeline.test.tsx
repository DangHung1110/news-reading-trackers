import type { ReadingEventDto } from '@news-tracker/contracts';
import { render, screen } from '@testing-library/react';

import { EventTimeline } from './event-timeline';

const events: ReadingEventDto[] = [
  {
    id: '1',
    eventId: 'event-1',
    eventType: 'PAGE_ENTER',
    sequenceNumber: 0,
    occurredAt: '2026-08-24T13:00:00.000Z',
    receivedAt: '2026-08-24T13:00:01.000Z',
  },
  {
    id: '2',
    eventId: 'event-2',
    eventType: 'PAGE_ACTIVE',
    sequenceNumber: 1,
    occurredAt: '2026-08-24T13:00:02.000Z',
    receivedAt: '2026-08-24T13:00:03.000Z',
  },
];

describe('EventTimeline', () => {
  it('renders event types in timeline order', () => {
    render(<EventTimeline events={events} />);

    const eventTypes = screen
      .getAllByRole('listitem')
      .map((item) => item.querySelector('strong')?.textContent);
    expect(eventTypes).toEqual(['PAGE_ENTER', 'PAGE_ACTIVE']);
    expect(screen.getByText('#1')).toBeInTheDocument();
  });
});
