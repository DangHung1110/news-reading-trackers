import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';

import { RealtimeProvider, useRealtimeStatus } from './realtime-provider';

class FakeEventSource {
  static current: FakeEventSource | null = null;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readonly close = vi.fn();
  private readonly listeners = new Map<string, EventListener>();

  constructor(readonly url: string) {
    FakeEventSource.current = this;
  }

  addEventListener(type: string, listener: EventListener): void {
    this.listeners.set(type, listener);
  }

  emit(type: string): void {
    this.listeners.get(type)?.(new Event(type));
  }
}

function ConnectionStatus() {
  return <span>{useRealtimeStatus()}</span>;
}

describe('RealtimeProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('EventSource', FakeEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    FakeEventSource.current = null;
  });

  it('reports disconnect and recovers when EventSource reconnects', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <RealtimeProvider>
          <ConnectionStatus />
        </RealtimeProvider>
      </QueryClientProvider>,
    );
    const source = FakeEventSource.current;
    expect(source).not.toBeNull();

    act(() => source?.onopen?.(new Event('open')));
    expect(screen.getByText('connected')).toBeInTheDocument();
    act(() => source?.onerror?.(new Event('error')));
    expect(screen.getByText('disconnected')).toBeInTheDocument();
    act(() => source?.onopen?.(new Event('open')));
    expect(screen.getByText('connected')).toBeInTheDocument();
  });

  it('invalidates article and dashboard caches after a realtime event', () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    render(
      <QueryClientProvider client={queryClient}>
        <RealtimeProvider>
          <ConnectionStatus />
        </RealtimeProvider>
      </QueryClientProvider>,
    );

    act(() => FakeEventSource.current?.emit('article.updated'));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['articles'] });
  });
});
