import type { HealthResponse } from '@news-tracker/contracts';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

type QueryValue = string | number | boolean | undefined;

function createUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(path.replace(/^\//, ''), `${apiBaseUrl}/`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    throw new Error(message ?? `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export const apiClient = {
  getHealth(): Promise<HealthResponse> {
    return request<HealthResponse>(new URL('/health', apiBaseUrl).toString());
  },
  get<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
    return request<T>(createUrl(path, query));
  },
  post<T>(path: string, body: unknown): Promise<T> {
    return request<T>(createUrl(path), { method: 'POST', body: JSON.stringify(body) });
  },
  put<T>(path: string, body: unknown): Promise<T> {
    return request<T>(createUrl(path), { method: 'PUT', body: JSON.stringify(body) });
  },
};
