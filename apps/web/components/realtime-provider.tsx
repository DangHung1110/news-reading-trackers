'use client';

import { REALTIME_EVENT_NAMES, type RealtimeEventName } from '@news-tracker/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { getApiUrl } from '../lib/api-client';

type RealtimeStatus = 'connecting' | 'connected' | 'disconnected';
const RealtimeContext = createContext<RealtimeStatus>('connecting');

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>('connecting');

  useEffect(() => {
    if (typeof EventSource === 'undefined') {
      setStatus('disconnected');
      return;
    }

    const source = new EventSource(getApiUrl('/stream'));
    source.onopen = () => setStatus('connected');
    source.onerror = () => setStatus('disconnected');

    const synchronize = (event: Event) => {
      const eventName = event.type as RealtimeEventName;
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
      if (eventName.startsWith('article.')) {
        void queryClient.invalidateQueries({ queryKey: ['articles'] });
      }
      if (eventName.startsWith('session.') || eventName === 'reading-event.created') {
        void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      }
    };
    for (const eventName of REALTIME_EVENT_NAMES) source.addEventListener(eventName, synchronize);

    return () => source.close();
  }, [queryClient]);

  return <RealtimeContext.Provider value={status}>{children}</RealtimeContext.Provider>;
}

export function useRealtimeStatus(): RealtimeStatus {
  return useContext(RealtimeContext);
}
