'use client';

import { useContext, useMemo, useState } from 'react';
import { QueryClient, QueryClientContext, useInfiniteQuery } from '@tanstack/react-query';
import { offerKeys } from '../query-keys';
import { useRealtimeInvalidation } from '@/lib/hooks/use-realtime-invalidation';
import {
  liveFeedResponseSchema,
  type LiveFeedResponse,
  type LivePageCursor,
} from '@/lib/live-contracts';
import type { AvailableRequestItem } from '../schemas';

export interface UseAvailableRequestsOptions {
  readonly filters?: Record<string, unknown>;
  readonly fetcher?: (
    cursor: LivePageCursor | null
  ) => Promise<LiveFeedResponse | readonly AvailableRequestItem[]>;
  readonly enabled?: boolean;
}

/**
 * Hook de datos en vivo para el panel de solicitudes disponibles del repartidor (feed).
 *
 * Cumple los invariantes de T-204 (D03 / 1-A & D04 / 1-A):
 * 1. TanStack Query `useInfiniteQuery` con `refetchOnWindowFocus: 'always'` y `refetchOnReconnect: 'always'`.
 * 2. Cero lecturas Supabase cliente: consume /api/live/available-requests validado con Zod.
 * 3. Supabase Realtime para invalidar consultas ante nuevas solicitudes u ofertas.
 * 4. Paginación por cursor keyset (createdAt, id), deduplicación pura en memoria sin mutar la caché.
 * 5. Polling de 30 s activo solo en pantallas visibles.
 * 6. Desuscripción de canal al desmontar.
 */
export function useAvailableRequests(
  initialRequests: readonly AvailableRequestItem[] = [],
  initialNextCursorOrOptions?: LivePageCursor | null | UseAvailableRequestsOptions,
  maybeOptions?: UseAvailableRequestsOptions
) {
  let initialNextCursor: LivePageCursor | null = null;
  let options: UseAvailableRequestsOptions | undefined = maybeOptions;

  if (
    initialNextCursorOrOptions &&
    typeof initialNextCursorOrOptions === 'object' &&
    ('fetcher' in initialNextCursorOrOptions ||
      'enabled' in initialNextCursorOrOptions ||
      'filters' in initialNextCursorOrOptions)
  ) {
    options = initialNextCursorOrOptions as UseAvailableRequestsOptions;
    initialNextCursor = null;
  } else if (initialNextCursorOrOptions) {
    initialNextCursor = initialNextCursorOrOptions as LivePageCursor;
  }

  const contextClient = useContext(QueryClientContext);
  const [fallbackClient] = useState(() => new QueryClient());
  const queryClient = contextClient ?? fallbackClient;

  const queryKey = offerKeys.availableRequests(options?.filters);
  const enabled = options?.enabled ?? true;

  const query = useInfiniteQuery(
    {
      queryKey,
      queryFn: async ({ pageParam }): Promise<LiveFeedResponse> => {
        if (options?.fetcher) {
          const res = await options.fetcher(pageParam);
          if ('data' in res && 'nextCursor' in res) {
            return res as LiveFeedResponse;
          }
          return { data: [...res], nextCursor: null };
        }

        let endpoint = '/api/live/available-requests';
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
        return liveFeedResponseSchema.parse(json);
      },
      initialPageParam: null as LivePageCursor | null,
      initialData: {
        pages: [
          {
            data: [...initialRequests],
            nextCursor: initialNextCursor,
          },
        ],
        pageParams: [null],
      },
      initialDataUpdatedAt: 0,
      getNextPageParam: (lastPage: LiveFeedResponse) => lastPage.nextCursor ?? undefined,
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

  const requests = useMemo(() => {
    const all = query.data?.pages?.flatMap((p) => p.data) ?? [...initialRequests];
    const seen = new Set<string>();
    const deduped: AvailableRequestItem[] = [];
    for (const item of all) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        deduped.push(item);
      }
    }
    return deduped;
  }, [query.data, initialRequests]);

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
    requests,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

