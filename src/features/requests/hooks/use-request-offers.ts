'use client';

import { useCallback, useRef, useState, useContext } from 'react';
import { QueryClient, QueryClientContext, useQuery } from '@tanstack/react-query';
import { requestKeys } from '../query-keys';
import { useRealtimeInvalidation } from '@/lib/hooks/use-realtime-invalidation';
import { createClient } from '@/lib/supabase/browser';
import type { MerchantOfferItem } from '../types';

export interface UseRequestOffersOptions {
  readonly onOfferAdded?: (offer: MerchantOfferItem) => void;
  readonly onOfferUpdated?: (offer: MerchantOfferItem) => void;
  readonly fetcher?: () => Promise<MerchantOfferItem[]>;
  readonly enabled?: boolean;
}

interface RawCourierRelation {
  vehicle_type?: string | null;
  license_status?: string | null;
  insurance_status?: string | null;
  doc_level?: number | null;
  profile?: {
    display_name?: string | null;
  } | Array<{ display_name?: string | null }> | null;
}

interface RawOfferDbRow {
  id: string;
  courier_id: string;
  amount_ars: number;
  eta_minutes: number;
  message: string | null;
  status: string;
  created_at: string;
  courier?: RawCourierRelation | RawCourierRelation[] | null;
}

interface RawRealtimeOfferPayload {
  readonly id?: string;
  readonly request_id?: string;
  readonly requestId?: string;
  readonly courier_id?: string;
  readonly courierId?: string;
  readonly courier_name?: string;
  readonly courierName?: string;
  readonly vehicle_type?: string | null;
  readonly vehicleType?: string | null;
  readonly amount_ars?: number;
  readonly amountArs?: number;
  readonly eta_minutes?: number;
  readonly etaMinutes?: number;
  readonly message?: string | null;
  readonly license_status?: 'none' | 'submitted' | 'verified' | 'rejected';
  readonly licenseStatus?: 'none' | 'submitted' | 'verified' | 'rejected';
  readonly insurance_status?: 'none' | 'submitted' | 'verified' | 'rejected';
  readonly insuranceStatus?: 'none' | 'submitted' | 'verified' | 'rejected';
  readonly doc_level?: 0 | 1 | 2;
  readonly docLevel?: 0 | 1 | 2;
  readonly created_at?: string;
  readonly createdAt?: string;
  readonly status?: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
}

function normalizeRealtimeOffer(raw: RawRealtimeOfferPayload): MerchantOfferItem {
  return {
    id: raw.id ?? 'unknown-offer',
    courierId: raw.courierId ?? raw.courier_id ?? 'unknown-courier',
    courierName: raw.courierName ?? raw.courier_name ?? 'Repartidor',
    vehicleType: raw.vehicleType ?? raw.vehicle_type ?? 'motorcycle',
    amountArs: raw.amountArs ?? raw.amount_ars ?? 0,
    etaMinutes: raw.etaMinutes ?? raw.eta_minutes ?? 15,
    message: raw.message ?? null,
    licenseStatus: raw.licenseStatus ?? raw.license_status ?? 'none',
    insuranceStatus: raw.insuranceStatus ?? raw.insurance_status ?? 'none',
    docLevel: (raw.docLevel ?? raw.doc_level ?? 0) as 0 | 1 | 2,
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    status: raw.status ?? 'pending',
  };
}

/**
 * Hook de datos en vivo para ofertas de una solicitud usando TanStack Query.
 *
 * Cumple los invariantes de T-204:
 * 1. TanStack Query con `refetchOnWindowFocus: 'always'` y `refetchOnReconnect: 'always'`.
 * 2. Supabase Realtime solo invalida la query con debounce; NO escribe la caché a mano.
 * 3. Polling de 30 s activo solo en pantallas visibles (`refetchIntervalInBackground: false`).
 * 4. Al desmontar la pantalla se cierra el canal Realtime.
 */
export function useRequestOffers(
  requestId: string,
  initialOffers: readonly MerchantOfferItem[] = [],
  options?: UseRequestOffersOptions
) {
  const contextClient = useContext(QueryClientContext);
  const [fallbackClient] = useState(() => (contextClient ? null : new QueryClient()));
  const queryClient = contextClient ?? fallbackClient!;

  const queryKey = requestKeys.offers(requestId);
  const enabled = Boolean(requestId) && (options?.enabled ?? true);
  const bufferedMockOffersRef = useRef<MerchantOfferItem[]>([]);

  const fetchOffers = useCallback(async (): Promise<MerchantOfferItem[]> => {
    if (options?.fetcher) {
      return options.fetcher();
    }

    const supabase = createClient();
    if (!supabase || typeof supabase.from !== 'function') {
      return [...initialOffers, ...bufferedMockOffersRef.current];
    }

    const { data, error } = await supabase
      .from('offers')
      .select(`
        id,
        courier_id,
        amount_ars,
        eta_minutes,
        message,
        status,
        created_at,
        courier:couriers!courier_id(
          vehicle_type,
          license_status,
          insurance_status,
          doc_level,
          profile:profiles!profile_id(display_name)
        )
      `)
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [...initialOffers];
    }

    const rows = data as unknown as RawOfferDbRow[];
    return rows.map((o) => {
      const courierObj = Array.isArray(o.courier) ? o.courier[0] : o.courier;
      const profileObj = courierObj?.profile
        ? Array.isArray(courierObj.profile)
          ? courierObj.profile[0]
          : courierObj.profile
        : null;

      return {
        id: o.id,
        courierId: o.courier_id,
        courierName: profileObj?.display_name || 'Repartidor',
        vehicleType: courierObj?.vehicle_type ?? 'motorcycle',
        amountArs: o.amount_ars,
        etaMinutes: o.eta_minutes,
        message: o.message,
        licenseStatus: (courierObj?.license_status as MerchantOfferItem['licenseStatus']) ?? 'none',
        insuranceStatus:
          (courierObj?.insurance_status as MerchantOfferItem['insuranceStatus']) ?? 'none',
        docLevel: ((courierObj?.doc_level as number) ?? 0) as 0 | 1 | 2,
        createdAt: o.created_at,
        status: o.status as MerchantOfferItem['status'],
      };
    });
  }, [requestId, options, initialOffers]);

  const query = useQuery(
    {
      queryKey,
      queryFn: fetchOffers,
      initialData: initialOffers ? [...initialOffers] : undefined,
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

  const [localOffers, setLocalOffersState] = useState<MerchantOfferItem[]>([...initialOffers]);
  const currentOffers = query.data ?? localOffers;

  // Notificar callbacks si las ofertas cambian
  const previousOffersRef = useRef<readonly MerchantOfferItem[]>(initialOffers);

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

  // Invalidación en tiempo real: NO muta la caché a mano; solo invalida con debounce
  useRealtimeInvalidation({
    channelName: `offers-${requestId}`,
    table: 'offers',
    filter: `request_id=eq.${requestId}`,
    queryKey,
    enabled,
    queryClient,
    onEvent: (payload) => {
      const p = payload as { new?: unknown } | null;
      if (p?.new && typeof p.new === 'object') {
        const raw = p.new as RawRealtimeOfferPayload;
        if (raw.id) {
          const normalized = normalizeRealtimeOffer(raw);
          const index = bufferedMockOffersRef.current.findIndex((o) => o.id === normalized.id);
          if (index >= 0) {
            bufferedMockOffersRef.current[index] = normalized;
          } else {
            bufferedMockOffersRef.current.push(normalized);
          }
        }
      }
    },
  });

  const setOffers = useCallback(
    (updater: React.SetStateAction<MerchantOfferItem[]>) => {
      queryClient.setQueryData<MerchantOfferItem[]>(queryKey, (old) => {
        const current = old ?? localOffers;
        const next = typeof updater === 'function' ? updater(current) : updater;
        setLocalOffersState(next);
        return next;
      });
    },
    [queryClient, queryKey, localOffers]
  );

  return {
    offers: currentOffers,
    setOffers,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
  };
}
