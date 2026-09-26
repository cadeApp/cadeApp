'use client';

import { useCallback, useRef, useState, useContext, useEffect, useMemo } from 'react';
import { QueryClient, QueryClientContext, useQuery } from '@tanstack/react-query';
import { requestKeys } from '../query-keys';
import { useRealtimeInvalidation } from '@/lib/hooks/use-realtime-invalidation';
import { liveOffersResponseSchema } from '@/lib/live-contracts';
import type { MerchantOfferItem } from '../types';

export interface UseRequestOffersOptions {
  readonly onOfferAdded?: (offer: MerchantOfferItem) => void;
  readonly onOfferUpdated?: (offer: MerchantOfferItem) => void;
  readonly fetcher?: () => Promise<MerchantOfferItem[]>;
  readonly enabled?: boolean;
}

/**
 * Hook de datos en vivo para ofertas de una solicitud usando TanStack Query.
 *
 * Cumple los invariantes de T-204 (D03 / 1-A):
 * 1. TanStack Query con `refetchOnWindowFocus: 'always'` y `refetchOnReconnect: 'always'`.
 * 2. Cero lecturas Supabase cliente: consume /api/live/requests/${requestId}/offers validado con Zod.
 * 3. Supabase Realtime solo invalida la query con debounce; NO escribe la caché a mano.
 * 4. Polling de 30 s activo solo en pantallas visibles (`refetchIntervalInBackground: false`).
 * 5. Al desmontar la pantalla se cierra el canal Realtime.
 */
export function useRequestOffers(
  requestId: string,
  initialOffers: readonly MerchantOfferItem[] = [],
  options?: UseRequestOffersOptions
) {
  const contextClient = useContext(QueryClientContext);
  const [fallbackClient] = useState(() => new QueryClient());
  const queryClient = contextClient ?? fallbackClient;

  const queryKey = requestKeys.offers(requestId);
  const enabled = Boolean(requestId) && (options?.enabled ?? true);

  const fetchOffers = useCallback(async (): Promise<MerchantOfferItem[]> => {
    if (options?.fetcher) {
      return options.fetcher();
    }

    const res = await fetch(`/api/live/requests/${encodeURIComponent(requestId)}/offers`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const json: unknown = await res.json();
    const parsed = liveOffersResponseSchema.parse(json);
    return parsed.data;
  }, [requestId, options]);

  const query = useQuery(
    {
      queryKey,
      queryFn: fetchOffers,
      initialData: initialOffers ? [...initialOffers] : undefined,
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

  const currentOffers = useMemo(
    () => query.data ?? [...initialOffers],
    [query.data, initialOffers]
  );

  // PR82-H13: Notificar callbacks desde useEffect posterior al render (no durante el render)
  const previousOffersRef = useRef<readonly MerchantOfferItem[]>(initialOffers);

  useEffect(() => {
    if (previousOffersRef.current !== currentOffers) {
      if (options?.onOfferAdded || options?.onOfferUpdated) {
        for (const offer of currentOffers) {
          const prev = previousOffersRef.current.find((o) => o.id === offer.id);
          if (!prev) {
            options.onOfferAdded?.(offer);
          } else if (JSON.stringify(prev) !== JSON.stringify(offer)) {
            options.onOfferUpdated?.(offer);
          }
        }
      }
      previousOffersRef.current = currentOffers;
    }
  }, [currentOffers, options]);

  // Invalidación en tiempo real: NO muta la caché a mano; solo invalida con debounce
  useRealtimeInvalidation({
    channelName: `offers-${requestId}`,
    table: 'offers',
    filter: `request_id=eq.${requestId}`,
    queryKey,
    enabled,
    queryClient,
  });

  return {
    offers: currentOffers,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
