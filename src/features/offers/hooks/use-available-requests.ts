'use client';

import { useContext, useState } from 'react';
import { QueryClient, QueryClientContext, useQuery } from '@tanstack/react-query';
import { offerKeys } from '../query-keys';
import { useRealtimeInvalidation } from '@/lib/hooks/use-realtime-invalidation';
import { liveFeedResponseSchema } from '@/lib/live-contracts';
import type { AvailableRequestItem } from '../schemas';

export interface UseAvailableRequestsOptions {
  readonly filters?: Record<string, unknown>;
  readonly fetcher?: () => Promise<AvailableRequestItem[]>;
  readonly enabled?: boolean;
}

/**
 * Hook de datos en vivo para el panel de solicitudes disponibles del repartidor (feed).
 *
 * Cumple los invariantes de T-204 (D03 / 1-A):
 * 1. TanStack Query con `refetchOnWindowFocus: 'always'` y `refetchOnReconnect: 'always'`.
 * 2. Cero lecturas Supabase cliente: consume /api/live/available-requests validado con Zod.
 * 3. Supabase Realtime para invalidar consultas ante nuevas solicitudes u ofertas.
 * 4. Polling de 30 s activo solo en pantallas visibles.
 * 5. Desuscripción de canal al desmontar.
 */
export function useAvailableRequests(
  initialRequests: readonly AvailableRequestItem[] = [],
  options?: UseAvailableRequestsOptions
) {
  const contextClient = useContext(QueryClientContext);
  const [fallbackClient] = useState(() => new QueryClient());
  const queryClient = contextClient ?? fallbackClient;

  const queryKey = offerKeys.availableRequests(options?.filters);
  const enabled = options?.enabled ?? true;

  const query = useQuery(
    {
      queryKey,
      queryFn: async (): Promise<AvailableRequestItem[]> => {
        if (options?.fetcher) {
          return options.fetcher();
        }

        const res = await fetch('/api/live/available-requests');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json: unknown = await res.json();
        const parsed = liveFeedResponseSchema.parse(json);
        return parsed.data;
      },
      initialData: initialRequests ? [...initialRequests] : undefined,
      initialDataUpdatedAt: 0,
      staleTime: 0,
      retry: false,
      refetchOnWindowFocus: 'always',
      refetchOnReconnect: 'always',
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
      enabled,
    },
    queryClient
  );

  useRealtimeInvalidation({
    channelName: 'courier-available-requests',
    subscriptions: [
      {
        table: 'delivery_requests',
        filter: 'status=eq.published',
        queryKey,
      },
      {
        table: 'offers',
        queryKey,
      },
    ],
    enabled,
    queryClient,
  });

  return {
    requests: query.data ?? [...initialRequests],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
