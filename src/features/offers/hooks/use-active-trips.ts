'use client';

import { useContext, useState } from 'react';
import { QueryClient, QueryClientContext, useQuery } from '@tanstack/react-query';
import { offerKeys } from '../query-keys';
import { useRealtimeInvalidation } from '@/lib/hooks/use-realtime-invalidation';
import { readActiveTripsAction } from '../actions';
import type { ActiveTripSummary, CourierStatus } from '../schemas';

export interface UseActiveTripsOptions {
  readonly courierId?: string;
  readonly initialTrips?: readonly ActiveTripSummary[];
  readonly courierStatus?: CourierStatus;
  readonly enabled?: boolean;
}

/**
 * Hook de datos en vivo para los viajes activos asignados al repartidor (T-360).
 * Particiona la caché por sesión de courierId, escucha delivery_requests y offers
 * vía Realtime y no depende de la disponibilidad (sigue activo con available=false).
 */
export function useActiveTrips(options?: UseActiveTripsOptions) {
  const contextClient = useContext(QueryClientContext);
  const [fallbackClient] = useState(() => new QueryClient());
  const queryClient = contextClient ?? fallbackClient;

  const courierId = options?.courierId;
  const initialTrips = options?.initialTrips ? [...options.initialTrips] : [];
  const courierStatus = options?.courierStatus ?? 'approved';
  const isApproved = courierStatus === 'approved';
  const isExplicitEnabled = options?.enabled ?? true;
  const isEnabled = isApproved && isExplicitEnabled && Boolean(courierId);

  const queryKey = offerKeys.activeTrips(courierId);

  const query = useQuery(
    {
      queryKey,
      queryFn: async (): Promise<ActiveTripSummary[]> => {
        const result = await readActiveTripsAction();
        if (result.courierId !== courierId) {
          throw new Error('Sesión no coincide con el repartidor consultado');
        }
        return result.trips;
      },
      initialData: initialTrips,
      initialDataUpdatedAt: 0,
      staleTime: 0,
      retry: false,
      refetchOnWindowFocus: 'always',
      refetchOnReconnect: 'always',
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
      enabled: isEnabled,
    },
    queryClient
  );

  useRealtimeInvalidation({
    channelName: `courier-active-trips-${courierId ?? 'anonymous'}`,
    subscriptions: [
      {
        table: 'delivery_requests',
        queryKey,
      },
      {
        table: 'offers',
        queryKey,
      },
    ],
    enabled: isEnabled,
    queryClient,
  });

  return {
    trips: query.isError ? [] : (query.data ?? initialTrips),
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
