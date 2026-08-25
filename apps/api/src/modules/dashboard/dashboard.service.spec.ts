import type { PrismaService } from '../../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  it('maps analytics rows and fills all 24 activity hours', async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ label: '2026-08-25', activeMs: 12_000n, inactiveMs: 3_000n }])
      .mockResolvedValueOnce([{ label: 'vnexpress.net', value: 2n }])
      .mockResolvedValueOnce([{ label: 'vnexpress.net', value: 12_000n }])
      .mockResolvedValueOnce([{ hour: 8, value: 3n }]);
    const service = new DashboardService({ $queryRaw: queryRaw } as unknown as PrismaService);

    const result = await service.getAnalytics({ days: 7 });

    expect(result.readingTimeByDate).toEqual([{ label: '2026-08-25', value: 12_000 }]);
    expect(result.activeInactiveByDate[0]).toEqual({
      label: '2026-08-25',
      activeMs: 12_000,
      inactiveMs: 3_000,
    });
    expect(result.activityByHour).toHaveLength(24);
    expect(result.activityByHour[8]).toEqual({ label: '08:00', value: 3 });
  });

  it('rejects an inverted date range', async () => {
    const service = new DashboardService({} as PrismaService);

    await expect(
      service.getAnalytics({
        days: 30,
        from: '2026-08-25T00:00:00.000Z',
        to: '2026-08-24T00:00:00.000Z',
      }),
    ).rejects.toThrow('from must be earlier than or equal to to');
  });
});
