'use client';

import type { SiteConfigDto } from '@news-tracker/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { apiClient } from '../../lib/api-client';

const splitLines = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export function CreateSiteConfig() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState('');
  const [pattern, setPattern] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [remove, setRemove] = useState('');
  const create = useMutation({
    mutationFn: () =>
      apiClient.post<SiteConfigDto>('/site-configs', {
        domain,
        enabled: true,
        articleUrlPatterns: splitLines(pattern),
        titleSelectors: splitLines(title),
        contentSelectors: splitLines(content),
        removeSelectors: splitLines(remove),
      }),
    onSuccess: () => {
      setOpen(false);
      setDomain('');
      setPattern('');
      setTitle('');
      setContent('');
      setRemove('');
      void queryClient.invalidateQueries({ queryKey: ['site-configs'] });
    },
  });

  if (!open)
    return (
      <button className="button" type="button" onClick={() => setOpen(true)}>
        Thêm website
      </button>
    );
  return (
    <section className="panel create-site-form">
      <div className="panel-heading">
        <h2>Thêm website</h2>
      </div>
      <div className="config-grid">
        <label>
          Domain
          <input
            value={domain}
            placeholder="example.com"
            onChange={(event) => setDomain(event.target.value)}
          />
        </label>
        <label>
          URL patterns
          <textarea value={pattern} onChange={(event) => setPattern(event.target.value)} />
        </label>
        <label>
          Title selectors
          <textarea value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          Content selectors
          <textarea value={content} onChange={(event) => setContent(event.target.value)} />
        </label>
        <label>
          Remove selectors
          <textarea value={remove} onChange={(event) => setRemove(event.target.value)} />
        </label>
      </div>
      <div className="form-actions">
        {create.isError ? <span className="form-error">{create.error.message}</span> : null}
        <button className="button secondary" type="button" onClick={() => setOpen(false)}>
          Hủy
        </button>
        <button
          className="button"
          type="button"
          disabled={create.isPending}
          onClick={() => create.mutate()}
        >
          Tạo cấu hình
        </button>
      </div>
    </section>
  );
}
