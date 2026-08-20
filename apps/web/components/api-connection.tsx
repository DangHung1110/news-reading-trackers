'use client';

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '../lib/api-client';

export function ApiConnection() {
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.getHealth(),
  });

  if (healthQuery.isPending) {
    return <p className="status status-pending">Checking API and database…</p>;
  }

  if (healthQuery.isError) {
    return (
      <div className="status status-error">
        <strong>Not connected</strong>
        <span>{healthQuery.error.message}</span>
      </div>
    );
  }

  return (
    <div className="status status-ok">
      <span className="status-dot" aria-hidden="true" />
      <strong>API ready</strong>
      <span>PostgreSQL: {healthQuery.data.database}</span>
    </div>
  );
}
