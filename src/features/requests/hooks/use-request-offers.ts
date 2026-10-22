'use client';

import { useRef, useState, useContext, useEffect, useMemo } from 'react';
import {
  QueryClient,
  QueryClientContext,
  onlineManager,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { requestKeys } from '../query-keys';
import { useRealtimeInvalidation } from '@/lib/hooks/use-realtime-invalidation';
import type {
  LiveOffersResponse,
  LivePageCursor,
} from '@/lib/live-contracts';
import type { MerchantOfferItem } from '../types';

export interface UseRequestOffersOptions {
  readonly onOfferAdded?: (offer: MerchantOfferItem) => void;
  readonly onOfferUpdated?: (offer: MerchantOfferItem) => void;
  readonly fetcher?: (
    cursor: LivePageCursor | null
  ) => Promise<LiveOffersResponse | readonly MerchantOfferItem[]>;
  readonly enabled?: boolean;
}

/**
 * Hook de datos en vivo para ofertas de una solicitud usando TanStack Query.
 *
 * Cumple los invariantes de T-204 (D03 / 1-A & D04 / 1-A):
 * 1. TanStack Query `useInfiniteQuery` con `refetchOnWindowFocus: 'always'` y `refetchOnReconnect: 'always'`.
 * 2. Cero lecturas Supabase cliente: consume /api/live/requests/${requestId}/offers validado con Zod.
 * 3. Supabase Realtime solo invalida la query con debounce; NO escribe la caché a mano.
 * 4. Paginación por cursor keyset (createdAt, id), deduplicación pura en memoria sin mutar la caché.
 * 5. Polling de 30 s activo solo en pantallas visibles (`refetchIntervalInBackground: false`).
 * 6. Al desmontar la pantalla se cierra el canal Realtime.
 */
export function useRequestOffers(
  requestId: string,
  initialOffers: readonly MerchantOfferItem[] = [],
  initialNextCursorOrOptions?: LivePageCursor | null | UseRequestOffersOptions,
  maybeOptions?: UseRequestOffersOptions
) {
  let initialNextCursor: LivePageCursor | null = null;
  let options: UseRequestOffersOptions | undefined = maybeOptions;

  if (
    initialNextCursorOrOptions &&
    typeof initialNextCursorOrOptions === 'object' &&
    ('fetcher' in initialNextCursorOrOptions ||
      'enabled' in initialNextCursorOrOptions ||
      'onOfferAdded' in initialNextCursorOrOptions ||
      'onOfferUpdated' in initialNextCursorOrOptions)
  ) {
    options = initialNextCursorOrOptions as UseRequestOffersOptions;
    initialNextCursor = null;
  } else if (initialNextCursorOrOptions) {
    initialNextCursor = initialNextCursorOrOptions as LivePageCursor;
  }

  const contextClient = useContext(QueryClientContext);
  const [fallbackClient] = useState(() => new QueryClient());
  const queryClient = contextClient ?? fallbackClient;

  const queryKey = requestKeys.offers(requestId);
  const enabled = Boolean(requestId) && (options?.enabled ?? true);

  // T-333: generación de cada fetch, incrementada al entrar realmente al queryFn (ver latch de reconexión).
  const fetchGenerationRef = useRef(0);
  // PR390-H16: Generación del último fetch que completó exitosamente su resolución.
  const lastResolvedGenerationRef = useRef(0);

  const [isOnline, setIsOnline] = useState(() => onlineManager.isOnline());
  const [offersSyncedAfterReconnect, setSyncedAfterReconnect] = useState(() =>
    onlineManager.isOnline()
  );
  // PR390-H13: Generación mínima requerida para autorizar la sincronización post-reconexión.
  const syncRequiredGenerationRef = useRef(0);
  // PR390-H16: Timestamp de reconexión para validar que dataUpdatedAt sea posterior.
  const reconnectEpochRef = useRef(0);

  useEffect(() => {
    let wasOnline = onlineManager.isOnline();
    const unsubscribe = onlineManager.subscribe((online) => {
      setIsOnline(online);
      if (!online) {
        setSyncedAfterReconnect(false);
        wasOnline = false;
      } else if (!wasOnline) {
        wasOnline = true;
        setSyncedAfterReconnect(false);
        // Exigir que la consulta que autorice la caché haya iniciado DESPUÉS de este momento
        syncRequiredGenerationRef.current = fetchGenerationRef.current + 1;
        reconnectEpochRef.current = Date.now();
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const query = useInfiniteQuery(
    {
      queryKey,
      queryFn: async ({ pageParam }): Promise<LiveOffersResponse> => {
        const generation = ++fetchGenerationRef.current;
        let response: LiveOffersResponse;
        if (options?.fetcher) {
          const res = await options.fetcher(pageParam);
          if ('data' in res && 'nextCursor' in res) {
            response = res as LiveOffersResponse;
          } else {
            response = { data: [...res], nextCursor: null };
          }
        } else {
          let endpoint = `/api/live/requests/${encodeURIComponent(requestId)}/offers`;
          if (pageParam) {
            const queryParams = new URLSearchParams({
              cursorCreatedAt: pageParam.createdAt,
              cursorId: pageParam.id,
            });
            endpoint += `?${queryParams.toString()}`;
          }

          const res = await fetch(endpoint, {
            cache: 'no-store',
          });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }

          const json: unknown = await res.json();
          const { liveOffersResponseSchema } = await import('@/lib/live-contracts');
          response = liveOffersResponseSchema.parse(json);
        }

        lastResolvedGenerationRef.current = generation;
        return response;
      },
      initialPageParam: null as LivePageCursor | null,
      initialData: {
        pages: [
          {
            data: [...initialOffers],
            nextCursor: initialNextCursor,
          },
        ],
        pageParams: [null],
      },
      initialDataUpdatedAt: 0,
      getNextPageParam: (lastPage: LiveOffersResponse) => lastPage.nextCursor ?? undefined,
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

  const currentOffers = useMemo(() => {
    const all = query.data?.pages?.flatMap((p) => p.data) ?? [...initialOffers];
    const seen = new Set<string>();
    const deduped: MerchantOfferItem[] = [];
    for (const item of all) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        deduped.push(item);
      }
    }
    return deduped;
  }, [query.data, initialOffers]);

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

  // T-333: si offline → online ocurre mientras un fetch sigue en vuelo, TanStack (onOnline con
  // cancelRefetch: false) reutiliza ese fetch y no pide datos nuevos. Se recuerda la generación que estaba en
  // vuelo y, cuando la query vuelve a idle, se refetchea una vez solo si no arrancó ninguna generación posterior
  // (un refetch competidor, p. ej. un invalidate, ya trae datos posteriores al reconnect). No depende del orden
  // de los listeners de onlineManager: solo compara generaciones.
  const reconnectDuringFetchRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const key = requestKeys.offers(requestId);
    let generationAtOffline: number | null = null;

    const unsubscribe = onlineManager.subscribe((online) => {
      const fetching = queryClient.getQueryState(key)?.fetchStatus === 'fetching';
      const generation = fetchGenerationRef.current;
      if (!online) {
        generationAtOffline = fetching ? generation : null;
        return;
      }
      if (generationAtOffline !== null && fetching && generation === generationAtOffline) {
        reconnectDuringFetchRef.current = generation;
      }
      generationAtOffline = null;
    });

    return () => {
      unsubscribe();
      reconnectDuringFetchRef.current = null;
    };
  }, [enabled, queryClient, requestId]);

  const {
    fetchStatus,
    dataUpdatedAt,
    errorUpdatedAt,
    isError,
    isRefetchError,
    error,
    refetch,
  } = query;

  useEffect(() => {
    const pending = reconnectDuringFetchRef.current;
    if (pending === null) return;
    // Ya arrancó una generación posterior al reconnect: esa trae los datos nuevos.
    if (fetchGenerationRef.current > pending) {
      reconnectDuringFetchRef.current = null;
      return;
    }
    if (queryClient.getQueryState(requestKeys.offers(requestId))?.fetchStatus !== 'idle') return;
    reconnectDuringFetchRef.current = null;
    if (onlineManager.isOnline()) {
      void refetch({ cancelRefetch: false });
    }
  }, [fetchStatus, dataUpdatedAt, errorUpdatedAt, refetch, queryClient, requestId]);

  // PR390-H16: La sincronización post-reconexión SOLO es válida cuando toda la consulta
  // infinita (todas sus páginas secuenciales) asentó con éxito en idle, sin errores
  // y con timestamp posterior a la reconexión.
  useEffect(() => {
    if (!isOnline || !onlineManager.isOnline()) {
      return;
    }

    if (syncRequiredGenerationRef.current === 0) {
      return;
    }

    const hasPostReconnectGeneration =
      lastResolvedGenerationRef.current >= syncRequiredGenerationRef.current;
    const isSettledSuccess =
      fetchStatus === 'idle' &&
      !isError &&
      !isRefetchError &&
      !error &&
      dataUpdatedAt >= reconnectEpochRef.current &&
      dataUpdatedAt >= errorUpdatedAt;
    const noPendingReconnectFetch = reconnectDuringFetchRef.current === null;

    if (hasPostReconnectGeneration && isSettledSuccess && noPendingReconnectFetch) {
      syncRequiredGenerationRef.current = 0;
      setSyncedAfterReconnect(true);
    }
  }, [
    isOnline,
    fetchStatus,
    isError,
    isRefetchError,
    error,
    dataUpdatedAt,
    errorUpdatedAt,
  ]);

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
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isOnline,
    offersSyncedAfterReconnect,
    fetchStatus: query.fetchStatus,
    dataUpdatedAt: query.dataUpdatedAt,
  };
}

