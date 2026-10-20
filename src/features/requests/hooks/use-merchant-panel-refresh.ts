'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useRealtimeInvalidation } from '@/lib/hooks/use-realtime-invalidation';

export const MERCHANT_PANEL_REFRESH_DEBOUNCE_MS = 400;
export const MERCHANT_PANEL_OFFERS_CHANNEL = 'merchant-panel-offers';

/**
 * El primer montaje del panel en el documento llega con datos recién pedidos al servidor. Los montajes siguientes son
 * reingresos por navegación interna (por ejemplo, volver desde el detalle) y pueden reutilizar el payload del router.
 * La marca vive en `window`: una recarga o un documento nuevo arrancan sin ella.
 */
export const MERCHANT_PANEL_MOUNTED_KEY = Symbol.for('cadeapp.merchantPanel.mountedInDocument');

function markPanelMounted(): boolean {
  const alreadyMounted = Reflect.get(window, MERCHANT_PANEL_MOUNTED_KEY) === true;
  Reflect.set(window, MERCHANT_PANEL_MOUNTED_KEY, true);
  return alreadyMounted;
}

/**
 * T-381: mantiene el panel del comercio (Server Component) al día con `router.refresh()`:
 * - reingreso por navegación interna: un refresco por montaje, salvo el primero del documento;
 * - foco o visibilidad de la pestaña;
 * - cambios de `offers` de sus solicitudes por Realtime (la RLS `offers_select_merchant` acota los eventos).
 * Todos pasan por el mismo debounce, así que una ráfaga dispara un solo refresco. Al desmontar se cancelan el timer,
 * los listeners y el canal.
 */
export function useMerchantPanelRefresh(): void {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      routerRef.current.refresh();
    }, MERCHANT_PANEL_REFRESH_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (markPanelMounted()) {
      scheduleRefresh();
    }

    const onFocus = () => scheduleRefresh();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleRefresh();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [scheduleRefresh]);

  useRealtimeInvalidation({
    channelName: MERCHANT_PANEL_OFFERS_CHANNEL,
    table: 'offers',
    event: '*',
    onEvent: scheduleRefresh,
  });
}
