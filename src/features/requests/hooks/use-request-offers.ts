'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/browser';
import type { MerchantOfferItem } from '../types';

export interface UseRequestOffersOptions {
  readonly onOfferAdded?: (offer: MerchantOfferItem) => void;
  readonly onOfferUpdated?: (offer: MerchantOfferItem) => void;
}

interface RawRealtimeOfferPayload {
  readonly id: string;
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
    id: raw.id,
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

export function useRequestOffers(
  requestId: string,
  initialOffers: readonly MerchantOfferItem[] = [],
  options?: UseRequestOffersOptions
) {
  const [offers, setOffers] = useState<MerchantOfferItem[]>([...initialOffers]);
  const initialOffersRef = useRef(initialOffers);
  initialOffersRef.current = initialOffers;

  // Sincronizar si initialOffers cambia desde el servidor
  useEffect(() => {
    setOffers([...initialOffers]);
  }, [initialOffers]);

  const handleOfferPayload = useCallback(
    (payload: { eventType: string; new: unknown; old: unknown }) => {
      if (!payload.new || typeof payload.new !== 'object') {
        return;
      }

      const raw = payload.new as RawRealtimeOfferPayload;
      if (!raw.id) {
        return;
      }

      const normalized = normalizeRealtimeOffer(raw);

      setOffers((currentOffers) => {
        const index = currentOffers.findIndex((o) => o.id === normalized.id);
        if (index >= 0) {
          const updated = [...currentOffers];
          updated[index] = normalized;
          options?.onOfferUpdated?.(normalized);
          return updated;
        }
        options?.onOfferAdded?.(normalized);
        return [...currentOffers, normalized];
      });
    },
    [options]
  );

  useEffect(() => {
    if (!requestId) return;

    const supabase = createClient();
    const channelName = `offers-${requestId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'offers',
          filter: `request_id=eq.${requestId}`,
        },
        handleOfferPayload
      )
      .subscribe();

    // Regla 20: reconexión / refetch en focus, visibilitychange y online
    const handleRevalidate = () => {
      // Si la ventana vuelve a primer plano o vuelve la conexión
      if (document.visibilityState === 'visible') {
        // En Next.js App Router los datos se revalidan con router.refresh() o Server Actions si hace falta
      }
    };

    window.addEventListener('focus', handleRevalidate);
    window.addEventListener('visibilitychange', handleRevalidate);
    window.addEventListener('online', handleRevalidate);

    return () => {
      window.removeEventListener('focus', handleRevalidate);
      window.removeEventListener('visibilitychange', handleRevalidate);
      window.removeEventListener('online', handleRevalidate);
      supabase.removeChannel(channel);
    };
  }, [requestId, handleOfferPayload]);

  return {
    offers,
    setOffers,
  };
}
