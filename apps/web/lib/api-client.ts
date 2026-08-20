import type { HealthResponse } from '@news-tracker/contracts';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export const apiClient = {
  getHealth(): Promise<HealthResponse> {
    return getJson<HealthResponse>(new URL('/health', apiBaseUrl).toString());
  },
  get<T>(path: string): Promise<T> {
    return getJson<T>(new URL(path.replace(/^\//, ''), `${apiBaseUrl}/`).toString());
  },
};
