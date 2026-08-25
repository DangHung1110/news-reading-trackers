import type { ReadingEventDto } from '@news-tracker/contracts';

import { formatTimelineTime } from '../../lib/format';

export function EventTimeline({ events }: { events: ReadingEventDto[] }) {
  return (
    <ol className="timeline">
      {events.map((event) => (
        <li key={event.eventId}>
          <time dateTime={event.occurredAt}>{formatTimelineTime(event.occurredAt)}</time>
          <strong>{event.eventType}</strong>
          <span>#{event.sequenceNumber}</span>
        </li>
      ))}
    </ol>
  );
}
