import { formatDuration } from './format';

describe('formatDuration', () => {
  it.each([
    [0, '0 giây'],
    [9_000, '9 giây'],
    [125_000, '2 phút 5 giây'],
    [3_725_000, '1 giờ 2 phút'],
  ])('formats %i milliseconds', (milliseconds, expected) => {
    expect(formatDuration(milliseconds)).toBe(expected);
  });
});
