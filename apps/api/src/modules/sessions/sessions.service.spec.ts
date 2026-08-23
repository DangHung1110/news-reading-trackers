import { ReadingEventType } from '@prisma/client';

import { calculateActiveReadingMs } from './sessions.service';

describe('calculateActiveReadingMs', () => {
  const startedAt = new Date('2026-08-23T00:00:00.000Z');
  const event = (eventType: ReadingEventType, sequenceNumber: number, offsetMs: number) => ({
    eventType,
    sequenceNumber,
    occurredAt: new Date(startedAt.getTime() + offsetMs),
  });

  it('sums multiple active intervals without counting inactive time', () => {
    expect(
      calculateActiveReadingMs([
        event(ReadingEventType.PAGE_ENTER, 0, 0),
        event(ReadingEventType.PAGE_ACTIVE, 1, 1_000),
        event(ReadingEventType.PAGE_INACTIVE, 2, 4_000),
        event(ReadingEventType.PAGE_ACTIVE, 3, 10_000),
        event(ReadingEventType.PAGE_LEAVE, 4, 15_000),
      ]),
    ).toBe(8_000);
  });

  it('sorts late events by sequence number and ignores duplicate transitions', () => {
    expect(
      calculateActiveReadingMs([
        event(ReadingEventType.PAGE_LEAVE, 6, 12_000),
        event(ReadingEventType.PAGE_ACTIVE, 1, 1_000),
        event(ReadingEventType.PAGE_ACTIVE, 2, 2_000),
        event(ReadingEventType.PAGE_ACTIVE, 5, 9_000),
        event(ReadingEventType.PAGE_INACTIVE, 3, 5_000),
        event(ReadingEventType.PAGE_INACTIVE, 4, 7_000),
      ]),
    ).toBe(7_000);
  });

  it('does not count an active interval without an inactive or leave event', () => {
    expect(
      calculateActiveReadingMs([
        event(ReadingEventType.PAGE_ENTER, 0, 0),
        event(ReadingEventType.PAGE_ACTIVE, 1, 1_000),
      ]),
    ).toBe(0);
  });
});
