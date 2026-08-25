'use client';

import type { SiteConfigDto } from '@news-tracker/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { apiClient } from '../../lib/api-client';

const joinLines = (values: string[]) => values.join('\n');
const splitLines = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export function SiteConfigCard({ config }: { config: SiteConfigDto }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(config.enabled);
  const [patterns, setPatterns] = useState(joinLines(config.articleUrlPatterns));
  const [titles, setTitles] = useState(joinLines(config.titleSelectors));
  const [contents, setContents] = useState(joinLines(config.contentSelectors));
  const [removes, setRemoves] = useState(joinLines(config.removeSelectors));
  const [testUrl, setTestUrl] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const update = useMutation({
    mutationFn: () =>
      apiClient.put<SiteConfigDto>(`/site-configs/${config.id}`, {
        enabled,
        articleUrlPatterns: splitLines(patterns),
        titleSelectors: splitLines(titles),
        contentSelectors: splitLines(contents),
        removeSelectors: splitLines(removes),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['site-configs'] }),
  });
  const testConfiguration = () => {
    try {
      const url = new URL(testUrl);
      const domainMatches = url.hostname.replace(/^www\./u, '') === config.domain;
      const patternMatches = splitLines(patterns).some((pattern) =>
        new RegExp(pattern, 'u').test(testUrl),
      );
      setTestResult(
        domainMatches && patternMatches
          ? 'URL phù hợp cấu hình.'
          : 'URL không khớp domain hoặc pattern.',
      );
    } catch {
      setTestResult('URL hoặc regular expression không hợp lệ.');
    }
  };

  return (
    <article className="site-card">
      <div className="site-card-heading">
        <div>
          <strong>{config.domain}</strong>
          <small>Cập nhật selector khi cấu trúc trang thay đổi.</small>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />{' '}
          Bật
        </label>
      </div>
      <div className="config-test">
        <input
          aria-label={`URL kiểm tra ${config.domain}`}
          placeholder={`https://${config.domain}/bai-viet...`}
          value={testUrl}
          onChange={(event) => setTestUrl(event.target.value)}
        />
        <button className="button secondary" type="button" onClick={testConfiguration}>
          Kiểm tra URL
        </button>
        {testResult === null ? null : <span>{testResult}</span>}
      </div>
      <div className="config-grid">
        <label>
          URL patterns
          <textarea value={patterns} onChange={(event) => setPatterns(event.target.value)} />
        </label>
        <label>
          Title selectors
          <textarea value={titles} onChange={(event) => setTitles(event.target.value)} />
        </label>
        <label>
          Content selectors
          <textarea value={contents} onChange={(event) => setContents(event.target.value)} />
        </label>
        <label>
          Remove selectors
          <textarea value={removes} onChange={(event) => setRemoves(event.target.value)} />
        </label>
      </div>
      <div className="form-actions">
        {update.isError ? <span className="form-error">{update.error.message}</span> : null}
        {update.isSuccess ? <span className="form-success">Đã lưu</span> : null}
        <button
          className="button"
          type="button"
          disabled={update.isPending}
          onClick={() => update.mutate()}
        >
          {update.isPending ? 'Đang lưu…' : 'Lưu cấu hình'}
        </button>
      </div>
    </article>
  );
}
