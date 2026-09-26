'use client';

import { useContext, useState } from 'react';
import { QueryClient, QueryClientContext, useQuery } from '@tanstack/react-query';
import { offerKeys } from '../query-keys';
import { useRealtimeInvalidation } from '@/lib/hooks/use-realtime-invalidation';
import { createClient } from '@/lib/supabase/browser';
import type { AvailableRequestItem } from '../schemas';

function formatApproxDistanceKm(distanceM: number | null): string {
  if (!distanceM || distanceM <= 0) {
    return '1,0';
  }
  const km = distanceM / 1000;
  const rounded = Math.round(km * 2) / 2;
  return rounded.toFixed(1).replace('.', ',');
}

interface RawAvailableRequestDbRow {
  id: string;
  approx_distance_m: number | null;
  package_type: string;
  recipient_payment_method: string;
  needs_change: boolean;
  cash_change_amount: number | null;
  notes: string | null;
  published_at: string | null;
  expires_at: string | null;
  pickup_zone?: { name: string } | Array<{ name: string }> | null;
  dropoff_zone?: { name: string } | Array<{ name: string }> | null;
}

export interface UseAvailableRequestsOptions {
  readonly filters?: Record<string, unknown>;
  readonly fetcher?: () => Promise<AvailableRequestItem[]>;
  readonly enabled?: boolean;
}

/**
 * Hook de datos en vivo para el panel de solicitudes disponibles del repartidor (feed).
 *
 * Cumple los invariantes de T-204:
 * 1. TanStack Query con `refetchOnWindowFocus: 'always'` y `refetchOnReconnect: 'always'`.
 * 2. Supabase Realtime para invalidar consultas ante nuevas solicitudes u ofertas.
 * 3. Polling de 30 s activo solo en pantallas visibles.
 * 4. Desuscripción de canal al desmontar.
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

        let supabase: ReturnType<typeof createClient>;
        try {
          supabase = createClient();
        } catch {
          return [];
        }
        if (!supabase || typeof supabase.from !== 'function') {
          return [];
        }

        const { data, error } = await supabase
          .from('delivery_requests')
          .select(`
            id,
            approx_distance_m,
            package_type,
            recipient_payment_method,
            needs_change,
            cash_change_amount,
            notes,
            published_at,
            expires_at,
            pickup_zone:zones!pickup_zone_id(name),
            dropoff_zone:zones!dropoff_zone_id(name)
          `)
          .eq('status', 'published')
          .order('published_at', { ascending: false });

        if (error || !data) {
          return [];
        }

        const rows = data as unknown as RawAvailableRequestDbRow[];
        const requestIds = rows.map((r) => r.id);
        const myOffersMap = new Map<string, number>();

        if (requestIds.length > 0 && supabase.auth && typeof supabase.auth.getUser === 'function') {
          try {
            const authRes = await supabase.auth.getUser();
            const user = authRes.data.user;
            if (user) {
              const { data: userOffers } = await supabase
                .from('offers')
                .select('request_id, amount_ars')
                .eq('courier_id', user.id)
                .in('request_id', requestIds)
                .eq('status', 'pending');

              if (userOffers) {
                const rawUserOffers = userOffers as unknown as Array<{
                  request_id: string;
                  amount_ars: number;
                }>;
                for (const off of rawUserOffers) {
                  myOffersMap.set(off.request_id, off.amount_ars);
                }
              }
            }
          } catch {
            // Error al consultar auth u offers: se continúa sin ofertas activas
          }
        }

        return rows.map((req) => {
          const pickupZone = Array.isArray(req.pickup_zone) ? req.pickup_zone[0] : req.pickup_zone;
          const dropoffZone = Array.isArray(req.dropoff_zone) ? req.dropoff_zone[0] : req.dropoff_zone;
          const myOfferAmount = myOffersMap.get(req.id) ?? null;

          return {
            id: req.id,
            pickupZoneName: pickupZone?.name ?? 'Centro',
            dropoffZoneName: dropoffZone?.name ?? 'Aguilares',
            approxDistanceKm: formatApproxDistanceKm(req.approx_distance_m),
            packageType: (req.package_type as AvailableRequestItem['packageType']) ?? 'small',
            recipientPaymentMethod:
              (req.recipient_payment_method as AvailableRequestItem['recipientPaymentMethod']) ??
              'cash',
            needsChange: Boolean(req.needs_change),
            cashChangeAmount: req.cash_change_amount,
            notes: req.notes,
            publishedAt: req.published_at ?? new Date().toISOString(),
            expiresAt: req.expires_at,
            hasMyOffer: myOfferAmount !== null,
            myOfferAmountArs: myOfferAmount,
          };
        });
      },
      initialData: initialRequests ? [...initialRequests] : undefined,
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
    refetch: query.refetch,
  };
}
