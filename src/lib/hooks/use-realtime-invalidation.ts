'use client';

import { useContext, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientContext } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/browser';

export interface RealtimeSubscriptionConfig {
  readonly table: string;
  readonly schema?: string;
  readonly filter?: string;
  readonly event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  readonly queryKey?: readonly unknown[];
}

export interface UseRealtimeInvalidationOptions {
  readonly channelName: string;
  readonly table?: string;
  readonly schema?: string;
  readonly filter?: string;
  readonly event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  readonly queryKey?: readonly unknown[];
  readonly subscriptions?: readonly RealtimeSubscriptionConfig[];
  readonly debounceMs?: number;
  readonly enabled?: boolean;
  readonly queryClient?: QueryClient;
  readonly onEvent?: (payload: unknown) => void;
}

/**
 * Hook para invalidar queries de TanStack Query mediante Supabase Realtime.
 *
 * Cumple con los invariantes de T-204:
 * 1. Un canal por pantalla con desuscripción al desmontar.
 * 2. Realtime NUNCA escribe la caché a mano; solo invalida queries con debounce.
 * 3. Al desmontar cancela timers pendientes de debounce y cierra el canal.
 */
export function useRealtimeInvalidation(options: UseRealtimeInvalidationOptions): void {
  const contextClient = useContext(QueryClientContext);
  const [fallbackClient] = useState(() => (contextClient ? null : new QueryClient()));
  const queryClient = options.queryClient ?? contextClient ?? fallbackClient!;

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingKeysRef = useRef<Map<string, readonly unknown[]>>(new Map());

  // Mantener referencias actualizadas de las opciones
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const enabled = options.enabled ?? true;
  const channelName = options.channelName;
  const debounceMs = options.debounceMs ?? 300;

  // Serializar la configuración de suscripción para detectar cambios aunque el channelName no varíe
  const serializedConfig = JSON.stringify({
    table: options.table,
    schema: options.schema,
    filter: options.filter,
    event: options.event,
    subscriptions: options.subscriptions,
    queryKey: options.queryKey,
  });

  useEffect(() => {
    if (!enabled || !channelName) {
      return;
    }

    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }
    const currentOptions = optionsRef.current;

    const subs: readonly RealtimeSubscriptionConfig[] =
      currentOptions.subscriptions && currentOptions.subscriptions.length > 0
        ? currentOptions.subscriptions
        : currentOptions.table
          ? [
              {
                table: currentOptions.table,
                schema: currentOptions.schema ?? 'public',
                filter: currentOptions.filter,
                event: currentOptions.event ?? '*',
                queryKey: currentOptions.queryKey,
              },
            ]
          : [];

    if (subs.length === 0) {
      return;
    }

    const triggerInvalidation = (targetKey?: readonly unknown[]) => {
      const key = targetKey ?? optionsRef.current.queryKey;
      if (key) {
        pendingKeysRef.current.set(JSON.stringify(key), key);
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        const keysToInvalidate = Array.from(pendingKeysRef.current.values());
        pendingKeysRef.current.clear();
        for (const k of keysToInvalidate) {
          void queryClient.invalidateQueries({ queryKey: k });
        }
      }, debounceMs);
    };

    let channel = supabase.channel(channelName);

    for (const sub of subs) {
      channel = channel.on(
        'postgres_changes',
        {
          event: sub.event ?? '*',
          schema: sub.schema ?? 'public',
          table: sub.table,
          ...(sub.filter ? { filter: sub.filter } : {}),
        },
        (payload: unknown) => {
          optionsRef.current.onEvent?.(payload);
          triggerInvalidation(sub.queryKey ?? currentOptions.queryKey);
        }
      );
    }

    channel.subscribe();

    const pendingKeys = pendingKeysRef.current;
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      pendingKeys.clear();
      supabase.removeChannel(channel);
    };
  }, [channelName, enabled, debounceMs, queryClient, serializedConfig]);
}
