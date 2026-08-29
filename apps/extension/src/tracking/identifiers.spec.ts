import { createEventId, createSessionId } from './identifiers';

describe('tracking identifiers', () => {
  it('creates unique UUIDs for sessions and events', () => {
    const sessionIds = new Set([createSessionId(), createSessionId()]);
    const eventIds = new Set([createEventId(), createEventId()]);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

    expect(sessionIds.size).toBe(2);
    expect(eventIds.size).toBe(2);
    for (const id of [...sessionIds, ...eventIds]) expect(id).toMatch(uuid);
  });
});
