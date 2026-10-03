// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import { Providers } from './providers';

describe('T-333 / PR236-H01: frontera navegador → onlineManager en Providers', () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');

  afterEach(() => {
    cleanup();
    if (originalOnLine) {
      Object.defineProperty(window.navigator, 'onLine', originalOnLine);
    } else {
      Reflect.deleteProperty(window.navigator, 'onLine');
    }
    onlineManager.setOnline(true);
  });

  it('sincroniza el estado inicial desde navigator.onLine y sigue los eventos online/offline de window', async () => {
    onlineManager.setOnline(true);
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => false });

    const { unmount } = render(
      <Providers>
        <div>probe</div>
      </Providers>
    );
    expect(screen.getByText('probe')).toBeDefined();

    await waitFor(() => {
      expect(onlineManager.isOnline()).toBe(false);
    });

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(onlineManager.isOnline()).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(onlineManager.isOnline()).toBe(false);

    unmount();
  });
});
