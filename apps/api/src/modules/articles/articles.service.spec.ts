import { ArticlesService } from './articles.service';
import type { PrismaService } from '../../prisma/prisma.service';

describe('ArticlesService', () => {
  const service = new ArticlesService({} as PrismaService);

  it('normalizes canonical URLs and removes tracking parameters', () => {
    expect(
      service.normalizeUrl(
        'https://WWW.VNEXPRESS.NET//tin-tuc/?utm_source=newsletter&b=2&fbclid=abc&a=1#top',
      ),
    ).toBe('https://vnexpress.net/tin-tuc?a=1&b=2');
  });

  it('calculates a stable hash and Vietnamese word count', () => {
    expect(service.countWords('  Đây là một bài báo.  ')).toBe(5);
    expect(service.hashContent('nội dung')).toHaveLength(64);
    expect(service.hashContent('nội dung')).toBe(service.hashContent('nội dung'));
  });
});
