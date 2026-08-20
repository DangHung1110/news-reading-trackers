import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';

import { ApiConnection } from './api-connection';

describe('ApiConnection', () => {
  it('shows a connected database response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', database: 'connected' }), { status: 200 }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ApiConnection />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('API ready')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL: connected')).toBeInTheDocument();
  });
});
