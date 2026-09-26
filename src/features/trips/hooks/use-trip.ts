'use client';

import { useContext, useState } from 'react';
import { QueryClient, QueryClientContext, useQuery } from '@tanstack/react-query';
import { tripKeys } from '../query-keys';
import { useRealtimeInvalidation } from '@/lib/hooks/use-realtime-invalidation';
import { liveTripResponseSchema } from '@/lib/live-contracts';

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
 * Cumple los invariantes de T-204 (D03 / 1-A):
 * 1. TanStack Query con `refetchOnWindowFocus: 'always'` y `refetchOnReconnect: 'always'`.
 * 2. Cero lecturas Supabase cliente: consume /api/live/trips/${tripId} validado con Zod.
 * 3. Supabase Realtime para invalidar consultas ante cambios de estado en delivery_requests.
 * 4. Polling de 30 s activo solo en pantallas visibles.
 * 5. Desuscripción de canal al desmontar.
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

        const res = await fetch(`/api/live/trips/${encodeURIComponent(tripId)}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json: unknown = await res.json();
        const parsed = liveTripResponseSchema.parse(json);

        if (!parsed.data) {
          return null;
        }

        if (initialTrip) {
          return {
            ...initialTrip,
            id: parsed.data.id,
            status: parsed.data.status,
          };
        }

        return parsed.data as unknown as T;
      },
      initialData: initialTrip ?? undefined,
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
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
