import { ReadingSessionTracker, type TrackingEvent } from './reading-session-tracker';

describe('ReadingSessionTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-23T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tracks active and inactive intervals with monotonic sequence numbers', () => {
    const events: TrackingEvent[] = [];
    const tracker = new ReadingSessionTracker((event) => events.push(event), 30_000);

    tracker.start({
      pageVisible: true,
      tabActive: true,
      windowFocused: true,
      browserIdle: false,
    });
    tracker.updateConditions({ pageVisible: false });
    tracker.updateConditions({ pageVisible: false });
    tracker.updateConditions({ pageVisible: true });
    tracker.leave();
    tracker.leave();

    expect(events.map(({ eventType }) => eventType)).toEqual([
      'PAGE_ENTER',
      'PAGE_ACTIVE',
      'PAGE_INACTIVE',
      'PAGE_ACTIVE',
      'PAGE_LEAVE',
    ]);
    expect(events.map(({ sequenceNumber }) => sequenceNumber)).toEqual([0, 1, 2, 3, 4]);
    expect(tracker.currentState).toBe('LEFT');
  });

  it('becomes inactive after no interaction and resumes on user activity', () => {
    const events: TrackingEvent[] = [];
    const tracker = new ReadingSessionTracker((event) => events.push(event), 30_000);

    tracker.start({
      pageVisible: true,
      tabActive: true,
      windowFocused: true,
      browserIdle: false,
    });
    vi.advanceTimersByTime(30_000);
    tracker.recordInteraction();
    tracker.updateConditions({ browserIdle: true });
    tracker.recordInteraction();
    tracker.updateConditions({ browserIdle: false });

    expect(events.map(({ eventType }) => eventType)).toEqual([
      'PAGE_ENTER',
      'PAGE_ACTIVE',
      'PAGE_HEARTBEAT',
      'PAGE_INACTIVE',
      'PAGE_ACTIVE',
      'PAGE_INACTIVE',
      'PAGE_ACTIVE',
    ]);
  });

  it('waits in ENTERED until all active conditions are satisfied', () => {
    const events: TrackingEvent[] = [];
    const tracker = new ReadingSessionTracker((event) => events.push(event));

    tracker.start({
      pageVisible: true,
      tabActive: false,
      windowFocused: true,
      browserIdle: false,
    });
    tracker.updateConditions({ tabActive: true });

    expect(events.map(({ eventType }) => eventType)).toEqual(['PAGE_ENTER', 'PAGE_ACTIVE']);
  });

  it('emits heartbeats only while the session is active', () => {
    const events: TrackingEvent[] = [];
    const tracker = new ReadingSessionTracker((event) => events.push(event));

    tracker.start({
      pageVisible: true,
      tabActive: true,
      windowFocused: true,
      browserIdle: false,
    });
    vi.advanceTimersByTime(15_000);
    tracker.updateConditions({ tabActive: false });
    vi.advanceTimersByTime(15_000);

    expect(events.map(({ eventType }) => eventType)).toEqual([
      'PAGE_ENTER',
      'PAGE_ACTIVE',
      'PAGE_HEARTBEAT',
      'PAGE_INACTIVE',
    ]);
  });
});
