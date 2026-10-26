'use client';

import { useContext, useState } from 'react';
import { QueryClient, QueryClientContext, useQuery } from '@tanstack/react-query';
import type { LiveOnlineCouriersResponse } from '@/lib/live-contracts';

/** T-415: el conteo se refresca cada minuto, solo con la pantalla visible. */
export const ONLINE_COURIERS_REFETCH_MS = 60_000;

export const onlineCouriersQueryKey = ['requests', 'online-couriers'] as const;

/** Lectura por la ruta en vivo, validada con el contrato (cero lecturas de Supabase desde el cliente). */
export async function fetchOnlineCouriers(): Promise<LiveOnlineCouriersResponse> {
  const response = await fetch('/api/live/online-couriers', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const json: unknown = await response.json();
  const { liveOnlineCouriersResponseSchema } = await import('@/lib/live-contracts');
  return liveOnlineCouriersResponseSchema.parse(json);
}

/** Opciones de la query: polling de un minuto que se pausa en segundo plano y refresca al volver. */
export function onlineCouriersQueryOptions(initial: LiveOnlineCouriersResponse | null) {
  return {
    queryKey: onlineCouriersQueryKey,
    queryFn: fetchOnlineCouriers,
    refetchInterval: ONLINE_COURIERS_REFETCH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always' as const,
    refetchOnReconnect: 'always' as const,
    ...(initial ? { initialData: initial, initialDataUpdatedAt: Date.now() } : {}),
  };
}

/** CC-041 (T-415): repartidores conectados ahora, para el comercio. */
export function useOnlineCouriers(initial: LiveOnlineCouriersResponse | null) {
  const contextClient = useContext(QueryClientContext);
  const [fallbackClient] = useState(() => new QueryClient());
  return useQuery(onlineCouriersQueryOptions(initial), contextClient ?? fallbackClient);
}
