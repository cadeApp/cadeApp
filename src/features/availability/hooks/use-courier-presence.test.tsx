// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { PRESENCE_INTERVAL_MS, useCourierPresence } from './use-courier-presence';

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('T-415: señal de presencia del repartidor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('manda la señal al prender «Disponible» y después cada 2 minutos', () => {
    const send = vi.fn().mockResolvedValue({ ok: true });
    renderHook(() => useCourierPresence(true, send));
    expect(send).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(PRESENCE_INTERVAL_MS);
    expect(send).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(PRESENCE_INTERVAL_MS);
    expect(send).toHaveBeenCalledTimes(3);
    expect(PRESENCE_INTERVAL_MS).toBe(120_000);
  });

  it('sin «Disponible» no manda nada', () => {
    const send = vi.fn().mockResolvedValue({ ok: true });
    renderHook(() => useCourierPresence(false, send));
    vi.advanceTimersByTime(PRESENCE_INTERVAL_MS * 3);
    expect(send).not.toHaveBeenCalled();
  });

  it('con la pantalla oculta no manda y al volver manda enseguida', () => {
    const send = vi.fn().mockResolvedValue({ ok: true });
    renderHook(() => useCourierPresence(true, send));
    expect(send).toHaveBeenCalledTimes(1);
    setVisibility('hidden');
    vi.advanceTimersByTime(PRESENCE_INTERVAL_MS * 2);
    expect(send).toHaveBeenCalledTimes(1);
    setVisibility('visible');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('al apagar «Disponible» o salir de la pantalla, para', () => {
    const send = vi.fn().mockResolvedValue({ ok: true });
    const { rerender, unmount } = renderHook(({ available }) => useCourierPresence(available, send), {
      initialProps: { available: true },
    });
    rerender({ available: false });
    vi.advanceTimersByTime(PRESENCE_INTERVAL_MS * 2);
    expect(send).toHaveBeenCalledTimes(1);

    rerender({ available: true });
    expect(send).toHaveBeenCalledTimes(2);
    unmount();
    vi.advanceTimersByTime(PRESENCE_INTERVAL_MS * 2);
    setVisibility('visible');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('una señal que falla no rompe nada ni corta las siguientes', async () => {
    const send = vi.fn().mockRejectedValue(new Error('offline'));
    renderHook(() => useCourierPresence(true, send));
    await Promise.resolve();
    vi.advanceTimersByTime(PRESENCE_INTERVAL_MS);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
