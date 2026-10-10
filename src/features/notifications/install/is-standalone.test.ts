import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isStandalone } from './is-standalone';

describe('T-338 DoD: Detección de modo instalado PWA (isStandalone)', () => {
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalWindow) {
      globalThis.window = originalWindow;
    }
    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    }
  });

  it('detecta standalone cuando matchMedia("(display-mode: standalone)") es true (Android / Desktop Chrome PWA)', () => {
    const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(window, 'matchMedia', {
      value: mockMatchMedia,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'navigator', {
      value: { standalone: false },
      writable: true,
      configurable: true,
    });

    expect(isStandalone()).toBe(true);
  });

  it('detecta standalone cuando navigator.standalone === true (iOS Safari PWA)', () => {
    const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(window, 'matchMedia', {
      value: mockMatchMedia,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'navigator', {
      value: { standalone: true },
      writable: true,
      configurable: true,
    });

    expect(isStandalone()).toBe(true);
  });

  it('devuelve false en navegador común (ni matchMedia standalone ni navigator.standalone)', () => {
    const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(window, 'matchMedia', {
      value: mockMatchMedia,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'navigator', {
      value: { standalone: false },
      writable: true,
      configurable: true,
    });

    expect(isStandalone()).toBe(false);
  });
});
