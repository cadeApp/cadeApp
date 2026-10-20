// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

/** Canal de Realtime falso: guarda el handler de `postgres_changes` y registra la baja del canal. */
const realtime = vi.hoisted(() => {
  const state: {
    handler: ((payload: unknown) => void) | null;
    subscriptions: Array<Record<string, unknown>>;
    removed: number;
  } = { handler: null, subscriptions: [], removed: 0 };
  const channel = {
    on: (_type: string, filter: Record<string, unknown>, handler: (payload: unknown) => void) => {
      state.subscriptions.push(filter);
      state.handler = handler;
      return channel;
    },
    subscribe: () => channel,
  };
  const client = {
    auth: { getSession: async () => ({ data: { session: null } }) },
    channel: () => channel,
    removeChannel: () => {
      state.removed += 1;
    },
  };
  return { state, client };
});

vi.mock('@/lib/supabase/browser', () => ({
  createClient: () => realtime.client,
}));

import {
  MERCHANT_PANEL_MOUNTED_KEY,
  MERCHANT_PANEL_REFRESH_DEBOUNCE_MS as debounce,
  useMerchantPanelRefresh,
} from './use-merchant-panel-refresh';

function Panel() {
  useMerchantPanelRefresh();
  return null;
}

async function settleRealtime() {
  await act(async () => {
    await vi.dynamicImportSettled();
  });
}

describe('T-381: useMerchantPanelRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refresh.mockClear();
    realtime.state.handler = null;
    realtime.state.subscriptions = [];
    realtime.state.removed = 0;
    // Documento «nuevo»: el próximo montaje del panel es el primero.
    Reflect.deleteProperty(window, MERCHANT_PANEL_MOUNTED_KEY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('el primer montaje no refresca; un reingreso por navegación interna refresca una sola vez y los rerenders no', async () => {
    const first = render(<Panel />);
    await act(async () => {
      vi.advanceTimersByTime(debounce * 3);
    });
    expect(refresh).not.toHaveBeenCalled();
    first.unmount();

    const reentry = render(<Panel />);
    await act(async () => {
      vi.advanceTimersByTime(debounce - 1);
    });
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 5; i += 1) {
      reentry.rerender(<Panel />);
    }
    await act(async () => {
      vi.advanceTimersByTime(debounce * 3);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('foco y visibilidad visible refrescan con debounce; oculta no; una ráfaga da un solo refresco', async () => {
    render(<Panel />);
    await settleRealtime();

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await act(async () => {
      vi.advanceTimersByTime(debounce);
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    visibility.mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await act(async () => {
      vi.advanceTimersByTime(debounce * 2);
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    // La pestaña vuelve a ser visible sin foco ni Realtime: la visibilidad sola dispara el refresco.
    visibility.mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await act(async () => {
      vi.advanceTimersByTime(debounce - 1);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(refresh).toHaveBeenCalledTimes(2);

    // Ráfaga de los tres disparadores: un solo refresco más.
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
      realtime.state.handler?.({ eventType: 'UPDATE', table: 'offers' });
    });
    await act(async () => {
      vi.advanceTimersByTime(debounce);
    });
    expect(refresh).toHaveBeenCalledTimes(3);
    visibility.mockRestore();
  });

  it('un cambio de offers por Realtime refresca con debounce, en un canal acotado a la tabla offers', async () => {
    render(<Panel />);
    await settleRealtime();

    expect(realtime.state.subscriptions).toEqual([
      { event: '*', schema: 'public', table: 'offers' },
    ]);
    act(() => {
      realtime.state.handler?.({ eventType: 'UPDATE', table: 'offers' });
      realtime.state.handler?.({ eventType: 'UPDATE', table: 'offers' });
    });
    await act(async () => {
      vi.advanceTimersByTime(debounce - 1);
    });
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('al desmontar cancela el refresco pendiente, saca los listeners y da de baja el canal', async () => {
    const panel = render(<Panel />);
    await settleRealtime();

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    panel.unmount();
    await act(async () => {
      vi.advanceTimersByTime(debounce * 3);
    });
    expect(refresh).not.toHaveBeenCalled();
    expect(realtime.state.removed).toBe(1);

    act(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await act(async () => {
      vi.advanceTimersByTime(debounce * 3);
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});
