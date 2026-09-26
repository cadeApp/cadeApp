'use client';

import { useContext, useState } from 'react';
import { QueryClient, QueryClientContext, useQuery } from '@tanstack/react-query';
import { tripKeys } from '../query-keys';
import { useRealtimeInvalidation } from '@/lib/hooks/use-realtime-invalidation';
import { createClient } from '@/lib/supabase/browser';

export interface TripDetailItem {
  readonly id: string;
  readonly status: 'matched' | 'in_transit' | 'delivered' | 'cancelled' | string;
  readonly pickupAddress?: string | null;
  readonly dropoffAddress?: string | null;
  readonly recipientName?: string | null;
  readonly recipientPhone?: string | null;
  readonly [key: string]: unknown;
}

export interface UseTripOptions<T = TripDetailItem> {
  readonly fetcher?: () => Promise<T | null>;
  readonly enabled?: boolean;
}

/**
 * Hook de datos en vivo para el viaje activo (vista del comercio o repartidor).
 *
 * Cumple los invariantes de T-204:
 * 1. TanStack Query con `refetchOnWindowFocus: 'always'` y `refetchOnReconnect: 'always'`.
 * 2. Supabase Realtime para invalidar consultas ante cambios de estado en delivery_requests.
 * 3. Polling de 30 s activo solo en pantallas visibles.
 * 4. Desuscripción de canal al desmontar.
 */
export function useTrip<T extends TripDetailItem = TripDetailItem>(
  tripId: string,
  initialTrip?: T | null,
  options?: UseTripOptions<T>
) {
  const contextClient = useContext(QueryClientContext);
  const [fallbackClient] = useState(() => new QueryClient());
  const queryClient = contextClient ?? fallbackClient;

  const queryKey = tripKeys.detail(tripId);
  const enabled = Boolean(tripId) && (options?.enabled ?? true);

  const query = useQuery(
    {
      queryKey,
      queryFn: async (): Promise<T | null> => {
        if (options?.fetcher) {
          return options.fetcher();
        }

        const supabase = createClient();
        if (!supabase || typeof supabase.from !== 'function') {
          return null;
        }

        const { data, error } = await supabase
          .from('delivery_requests')
          .select('id, status')
          .eq('id', tripId)
          .maybeSingle();

        if (error || !data) {
          return null;
        }

        const freshData = data as unknown as { id: string; status: TripDetailItem['status'] };
        if (initialTrip) {
          return {
            ...initialTrip,
            id: freshData.id,
            status: freshData.status,
          };
        }

        return freshData as unknown as T;
      },
      initialData: initialTrip ?? undefined,
      initialDataUpdatedAt: 0,
      staleTime: 0,
      refetchOnWindowFocus: 'always',
      refetchOnReconnect: 'always',
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
      enabled,
    },
    queryClient
  );

  useRealtimeInvalidation({
    channelName: `trip-${tripId}`,
    subscriptions: [
      {
        table: 'delivery_requests',
        filter: `id=eq.${tripId}`,
        queryKey,
      },
    ],
    enabled,
    queryClient,
  });

  return {
    trip: query.data !== undefined ? query.data : (initialTrip ?? null),
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
  };
}
