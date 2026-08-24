import type { ReadingEventType } from '@news-tracker/contracts';

export type TrackingState = 'NOT_TRACKING' | 'ENTERED' | 'ACTIVE' | 'INACTIVE' | 'LEFT';

export interface ActivityConditions {
  pageVisible: boolean;
  tabActive: boolean;
  windowFocused: boolean;
  browserIdle: boolean;
}

export interface TrackingEvent {
  eventType: Extract<
    ReadingEventType,
    'PAGE_ENTER' | 'PAGE_ACTIVE' | 'PAGE_INACTIVE' | 'PAGE_LEAVE' | 'PAGE_HEARTBEAT'
  >;
  sequenceNumber: number;
  occurredAt: string;
  context: ActivityConditions & { interactionIdle: boolean };
}

type EventSink = (event: TrackingEvent) => void;

export class ReadingSessionTracker {
  private state: TrackingState = 'NOT_TRACKING';
  private sequenceNumber = 0;
  private interactionIdle = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private conditions: ActivityConditions = {
    pageVisible: false,
    tabActive: false,
    windowFocused: false,
    browserIdle: false,
  };

  constructor(
    private readonly eventSink: EventSink,
    private readonly idleTimeoutMs = 30_000,
    private readonly now: () => number = Date.now,
    private readonly heartbeatIntervalMs = 15_000,
  ) {}

  get currentState(): TrackingState {
    return this.state;
  }

  start(conditions: ActivityConditions): void {
    if (this.state !== 'NOT_TRACKING') return;
    this.conditions = conditions;
    this.state = 'ENTERED';
    this.emit('PAGE_ENTER');
    this.resetInteractionTimer();
    this.evaluateActivity();
  }

  updateConditions(update: Partial<ActivityConditions>): void {
    if (this.state === 'LEFT') return;
    this.conditions = { ...this.conditions, ...update };
    this.evaluateActivity();
  }

  recordInteraction(): void {
    if (this.state === 'NOT_TRACKING' || this.state === 'LEFT') return;
    this.interactionIdle = false;
    this.resetInteractionTimer();
    this.evaluateActivity();
  }

  leave(): void {
    if (this.state === 'NOT_TRACKING' || this.state === 'LEFT') return;
    this.clearIdleTimer();
    this.stopHeartbeat();
    this.state = 'LEFT';
    this.emit('PAGE_LEAVE');
  }

  private evaluateActivity(): void {
    if (this.state === 'NOT_TRACKING' || this.state === 'LEFT') return;
    const shouldBeActive =
      this.conditions.pageVisible &&
      this.conditions.tabActive &&
      this.conditions.windowFocused &&
      !this.conditions.browserIdle &&
      !this.interactionIdle;

    if (shouldBeActive && this.state !== 'ACTIVE') {
      this.state = 'ACTIVE';
      this.emit('PAGE_ACTIVE');
      this.startHeartbeat();
    } else if (!shouldBeActive && this.state === 'ACTIVE') {
      this.stopHeartbeat();
      this.state = 'INACTIVE';
      this.emit('PAGE_INACTIVE');
    }
  }

  private resetInteractionTimer(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.interactionIdle = true;
      this.evaluateActivity();
    }, this.idleTimeoutMs);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer === null) return;
    clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.state === 'ACTIVE') this.emit('PAGE_HEARTBEAT');
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer === null) return;
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private emit(eventType: TrackingEvent['eventType']): void {
    this.eventSink({
      eventType,
      sequenceNumber: this.sequenceNumber++,
      occurredAt: new Date(this.now()).toISOString(),
      context: { ...this.conditions, interactionIdle: this.interactionIdle },
    });
  }
}
