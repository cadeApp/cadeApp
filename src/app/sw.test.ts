import { describe, expect, it, vi } from 'vitest';
import {
  CACHE_NAME,
  STATIC_ASSETS,
  handleFetch,
  handleActivate,
  isCacheableRequest,
} from './sw';

describe('T-201: Service Worker & Offline Shell Cache', () => {
  it('DoD: debe definir CACHE_NAME versionado y lista de assets del shell', () => {
    expect(CACHE_NAME).toMatch(/^cadeapp-shell-v\d+/);
    expect(STATIC_ASSETS).toBeInstanceOf(Array);
    expect(STATIC_ASSETS).toContain('/');
    expect(STATIC_ASSETS).toContain('/manifest.webmanifest');
  });

  it('DoD: solo peticiones GET de lectura son cacheables; mutaciones y APIs confidenciales son excluidas', () => {
    // GET requests autorizadas
    expect(isCacheableRequest(new Request('https://cadeapp.ar/'))).toBe(true);
    expect(isCacheableRequest(new Request('https://cadeapp.ar/brand/logo.svg'))).toBe(true);

    // Métodos mutativos no deben cachearse
    expect(isCacheableRequest(new Request('https://cadeapp.ar/api/trips', { method: 'POST' }))).toBe(false);
    expect(isCacheableRequest(new Request('https://cadeapp.ar/api/offers', { method: 'PUT' }))).toBe(false);
    expect(isCacheableRequest(new Request('https://cadeapp.ar/api/requests', { method: 'DELETE' }))).toBe(false);

    // Rutas protegidas / confidenciales no se deben cachear en el SW shell
    expect(isCacheableRequest(new Request('https://cadeapp.ar/api/auth/callback'))).toBe(false);
    expect(isCacheableRequest(new Request('https://cadeapp.ar/api/push/send'))).toBe(false);
    expect(isCacheableRequest(new Request('https://cadeapp.ar/storage/v1/object/courier-docs/doc123'))).toBe(false);
  });

  it('DoD: handleFetch debe devolver respuesta desde red y fallback al caché si está offline', async () => {
    const mockCache = {
      match: vi.fn(),
      put: vi.fn(),
    };
    const mockCaches = {
      open: vi.fn().mockResolvedValue(mockCache),
    };
    (globalThis as unknown as { caches: typeof mockCaches }).caches = mockCaches;

    // Simular falla de red (offline)
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    mockCache.match.mockResolvedValue(new Response('<html>Offline Shell</html>', { status: 200 }));

    const response = await handleFetch(new Request('https://cadeapp.ar/mis-solicitudes'));
    expect(response).toBeDefined();
    expect(await response.text()).toContain('Offline Shell');

    globalThis.fetch = originalFetch;
  });

  it('DoD: handleActivate debe purgar caches de versiones anteriores', async () => {
    const mockCaches = {
      keys: vi.fn().mockResolvedValue(['cadeapp-shell-v0', CACHE_NAME, 'other-cache']),
      delete: vi.fn().mockResolvedValue(true),
    };
    (globalThis as unknown as { caches: typeof mockCaches }).caches = mockCaches;

    await handleActivate();

    expect(mockCaches.delete).toHaveBeenCalledWith('cadeapp-shell-v0');
    expect(mockCaches.delete).not.toHaveBeenCalledWith(CACHE_NAME);
  });
});
