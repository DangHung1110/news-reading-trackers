export function createSessionId(): string {
  return crypto.randomUUID();
}

export function createEventId(): string {
  return crypto.randomUUID();
}
