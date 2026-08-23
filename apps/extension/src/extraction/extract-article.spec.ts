import danTriFixture from './__fixtures__/dantri.html?raw';
import tuoiTreFixture from './__fixtures__/tuoitre.html?raw';
import vnExpressFixture from './__fixtures__/vnexpress.html?raw';
import { DEFAULT_SITE_CONFIGS } from '../config/site-defaults';
import { extractArticle, findMatchingSiteConfig } from './extract-article';

interface FixtureCase {
  domain: string;
  url: string;
  html: string;
  title: string;
  canonicalUrl: string;
  irrelevantText: string;
}

const fixtures: FixtureCase[] = [
  {
    domain: 'vnexpress.net',
    url: 'https://www.vnexpress.net/kinh-doanh/bai-viet-kiem-thu-1234567.html?utm_medium=test',
    html: vnExpressFixture,
    title: 'Kinh tế Việt Nam duy trì đà tăng trưởng tích cực',
    canonicalUrl: 'https://vnexpress.net/kinh-doanh/bai-viet-kiem-thu-1234567.html',
    irrelevantText: 'QUẢNG CÁO VNEXPRESS KHÔNG ĐƯỢC LẤY',
  },
  {
    domain: 'dantri.com.vn',
    url: 'https://dantri.com.vn/xa-hoi/thanh-pho-trien-khai-du-an-moi-20260821123456789.htm',
    html: danTriFixture,
    title: 'Thành phố triển khai dự án giao thông kết nối khu vực',
    canonicalUrl:
      'https://dantri.com.vn/xa-hoi/thanh-pho-trien-khai-du-an-moi-20260821123456789.htm',
    irrelevantText: 'TIN LIÊN QUAN DÂN TRÍ KHÔNG ĐƯỢC LẤY',
  },
  {
    domain: 'tuoitre.vn',
    url: 'https://tuoitre.vn/giao-duc-doi-moi-phuong-phap-hoc-tap-20260821123456789.htm',
    html: tuoiTreFixture,
    title: 'Trường học đổi mới phương pháp học tập cho học sinh',
    canonicalUrl: 'https://tuoitre.vn/giao-duc-doi-moi-phuong-phap-hoc-tap-20260821123456789.htm',
    irrelevantText: 'QUẢNG CÁO TUỔI TRẺ KHÔNG ĐƯỢC LẤY',
  },
];

describe('article extraction fixtures', () => {
  it.each(fixtures)('extracts $domain article content safely', (fixture) => {
    const document = new DOMParser().parseFromString(fixture.html, 'text/html');
    const article = extractArticle(document, fixture.url, DEFAULT_SITE_CONFIGS);

    expect(article).not.toBeNull();
    expect(article?.domain).toBe(fixture.domain);
    expect(article?.title).toBe(fixture.title);
    expect(article?.canonicalUrl).toBe(fixture.canonicalUrl);
    expect(article?.content).not.toContain(fixture.irrelevantText);
    expect(article?.content.length).toBeGreaterThan(200);
    expect(article?.wordCount).toBeGreaterThan(30);
    expect(article?.extractionStatus).toBe('SUCCESS');
  });

  it('does not treat a homepage as an article URL', () => {
    expect(findMatchingSiteConfig('https://vnexpress.net/', DEFAULT_SITE_CONFIGS)).toBeNull();
  });

  it('does not crash when a remote selector or URL pattern is invalid', () => {
    const config = DEFAULT_SITE_CONFIGS[0];
    if (config === undefined) throw new Error('Missing VnExpress default config');
    const document = new DOMParser().parseFromString(vnExpressFixture, 'text/html');

    expect(() =>
      extractArticle(document, fixtures[0]?.url ?? '', [
        {
          ...config,
          titleSelectors: ['[invalid-selector'],
          contentSelectors: ['[invalid-selector'],
          removeSelectors: ['[invalid-selector'],
        },
      ]),
    ).not.toThrow();
    expect(
      findMatchingSiteConfig(fixtures[0]?.url ?? '', [
        { ...config, articleUrlPatterns: ['[invalid-regex'] },
      ]),
    ).toBeNull();
  });

  it('falls back to the generic extractor when site selectors no longer match', () => {
    const config = DEFAULT_SITE_CONFIGS[0];
    if (config === undefined) throw new Error('Missing VnExpress default config');
    const content = 'Nội dung bài báo dùng bộ trích xuất dự phòng. '.repeat(20);
    const document = new DOMParser().parseFromString(
      `<html><body><h1>Tiêu đề dự phòng</h1><article><p>${content}</p></article></body></html>`,
      'text/html',
    );

    const article = extractArticle(document, fixtures[0]?.url ?? '', [
      {
        ...config,
        titleSelectors: ['.selector-does-not-exist'],
        contentSelectors: ['.selector-does-not-exist'],
      },
    ]);

    expect(article?.title).toBe('Tiêu đề dự phòng');
    expect(article?.extractionStatus).toBe('SUCCESS');
  });

  it('returns PARTIAL or FAILED instead of throwing for incomplete documents', () => {
    const config = DEFAULT_SITE_CONFIGS[0];
    if (config === undefined) throw new Error('Missing VnExpress default config');
    const url = fixtures[0]?.url ?? '';
    const partialDocument = new DOMParser().parseFromString(
      '<html><head><title>Chỉ có tiêu đề</title></head><body></body></html>',
      'text/html',
    );
    const failedDocument = new DOMParser().parseFromString(
      '<html><head><title></title></head><body></body></html>',
      'text/html',
    );

    expect(extractArticle(partialDocument, url, [config])?.extractionStatus).toBe('PARTIAL');
    expect(extractArticle(failedDocument, url, [config])?.extractionStatus).toBe('FAILED');
  });
});
