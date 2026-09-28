import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FetchEventLike {
  request: Request;
  respondWith: (promise: Promise<Response>) => void;
  waitUntil: (promise: Promise<unknown>) => void;
}

interface ExtendableEventLike {
  waitUntil: (promise: Promise<unknown>) => void;
}

type TestListener = (event: unknown) => void;

interface SWContext {
  listeners: Record<string, TestListener[]>;
  mockCache: {
    match: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    addAll: ReturnType<typeof vi.fn>;
  };
  mockCaches: {
    open: ReturnType<typeof vi.fn>;
    match: ReturnType<typeof vi.fn>;
    keys: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  mockFetch: ReturnType<typeof vi.fn>;
  dispatchFetch: (request: Request) => Promise<Response | null>;
  dispatchInstall: () => Promise<void>;
  dispatchActivate: () => Promise<void>;
}

function createSWInstance(customCode?: string): SWContext {
  const code =
    customCode ??
    fs.readFileSync(path.resolve(process.cwd(), 'public/sw.js'), 'utf-8');

  const listeners: Record<string, TestListener[]> = {};

  const mockCache = {
    match: vi.fn(),
    put: vi.fn().mockResolvedValue(undefined),
    addAll: vi.fn().mockResolvedValue(undefined),
  };

  const mockCaches = {
    open: vi.fn().mockResolvedValue(mockCache),
    match: vi.fn().mockResolvedValue(undefined),
    keys: vi.fn().mockResolvedValue(['cadeapp-shell-v0', 'cadeapp-shell-v1', 'other-cache']),
    delete: vi.fn().mockResolvedValue(true),
  };

  const mockFetch = vi.fn();

  const sandbox: Record<string, unknown> = {
    location: { origin: 'https://cadeapp.ar' },
    addEventListener: (type: string, fn: TestListener) => {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    skipWaiting: vi.fn().mockResolvedValue(undefined),
    clients: {
      claim: vi.fn().mockResolvedValue(undefined),
    },
    caches: mockCaches,
    fetch: mockFetch,
    URL: globalThis.URL,
    Request: globalThis.Request,
    Response: globalThis.Response,
    Headers: globalThis.Headers,
    Promise,
    console,
  };
  sandbox.self = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(code, context);

  const dispatchFetch = async (request: Request): Promise<Response | null> => {
    let respondedWithPromise: Promise<Response> | null = null;
    const event: FetchEventLike = {
      request,
      respondWith: (promise: Promise<Response>) => {
        respondedWithPromise = promise;
      },
      waitUntil: vi.fn(),
    };

    const fetchListeners = listeners['fetch'] || [];
    for (const listener of fetchListeners) {
      listener(event);
    }

    if (!respondedWithPromise) {
      return null;
    }
    return await respondedWithPromise;
  };

  const dispatchInstall = async () => {
    let waitUntilPromise: Promise<unknown> | null = null;
    const event: ExtendableEventLike = {
      waitUntil: (promise: Promise<unknown>) => {
        waitUntilPromise = promise;
      },
    };
    for (const listener of listeners['install'] || []) {
      listener(event);
    }
    if (waitUntilPromise) {
      await waitUntilPromise;
    }
  };

  const dispatchActivate = async () => {
    let waitUntilPromise: Promise<unknown> | null = null;
    const event: ExtendableEventLike = {
      waitUntil: (promise: Promise<unknown>) => {
        waitUntilPromise = promise;
      },
    };
    for (const listener of listeners['activate'] || []) {
      listener(event);
    }
    if (waitUntilPromise) {
      await waitUntilPromise;
    }
  };

  return {
    listeners,
    mockCache,
    mockCaches,
    mockFetch,
    dispatchFetch,
    dispatchInstall,
    dispatchActivate,
  };
}

describe('PR117-H02 / D03: Service Worker Runtime Execution (public/sw.js via node:vm)', () => {
  let sw: SWContext;

  beforeEach(() => {
    sw = createSWInstance();
  });

  it('1. /brand/logo.svg same-origin 200 → interceptado y puede persistirse en Cache Storage', async () => {
    const request = new Request('https://cadeapp.ar/brand/logo.svg');
    const mockNetworkResponse = new Response('<svg>logo</svg>', {
      status: 200,
      headers: { 'content-type': 'image/svg+xml' },
    });

    sw.mockCache.match.mockResolvedValue(undefined);
    sw.mockFetch.mockResolvedValue(mockNetworkResponse);

    const response = await sw.dispatchFetch(request);

    expect(response).not.toBeNull();
    expect(response?.status).toBe(200);
    expect(sw.mockCache.put).toHaveBeenCalledWith(request, expect.anything());
  });

  it('2. /_next/static/chunks/app.js → interceptado y puede persistirse en Cache Storage', async () => {
    const request = new Request('https://cadeapp.ar/_next/static/chunks/app.js');
    const mockNetworkResponse = new Response('console.log("chunk");', {
      status: 200,
      headers: { 'content-type': 'application/javascript' },
    });

    sw.mockCache.match.mockResolvedValue(undefined);
    sw.mockFetch.mockResolvedValue(mockNetworkResponse);

    const response = await sw.dispatchFetch(request);

    expect(response).not.toBeNull();
    expect(sw.mockCache.put).toHaveBeenCalledWith(request, expect.anything());
  });

  it('3. /api/health, /api/requests, /api/auth/**, /api/push/** y storage → no se interceptan ni persisten', async () => {
    const sensitiveUrls = [
      'https://cadeapp.ar/api/health',
      'https://cadeapp.ar/api/requests',
      'https://cadeapp.ar/api/auth/callback',
      'https://cadeapp.ar/api/push/subscribe',
      'https://cadeapp.ar/storage/v1/object/courier-docs/dni.pdf',
      'https://cadeapp.ar/courier/feed?_rsc=123',
    ];

    for (const url of sensitiveUrls) {
      const request = new Request(url);
      const response = await sw.dispatchFetch(request);

      // No debe entrar en respondWith (deja pasar la petición nativa)
      expect(response).toBeNull();
      expect(sw.mockCache.put).not.toHaveBeenCalled();
    }
  });

  it('4. navegación /courier/feed con red OK → respuesta de red y CERO cache.put de ese HTML', async () => {
    const request = new Request('https://cadeapp.ar/courier/feed', {
      headers: { accept: 'text/html,application/xhtml+xml' },
    });
    const mockHtmlResponse = new Response('<html><body>Feed Repartidor Autenticado</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    });

    sw.mockFetch.mockResolvedValue(mockHtmlResponse);

    const response = await sw.dispatchFetch(request);

    expect(response).not.toBeNull();
    expect(await response?.text()).toBe('<html><body>Feed Repartidor Autenticado</body></html>');
    // Invariante D03: HTML dinámico/autenticado NUNCA se persiste en cache
    expect(sw.mockCache.put).toHaveBeenCalledTimes(0);
  });

  it('5. navegación /courier/feed con red caída → fallback al shell /', async () => {
    const request = new Request('https://cadeapp.ar/courier/feed', {
      headers: { accept: 'text/html' },
    });

    sw.mockFetch.mockRejectedValue(new Error('Network error / offline'));
    sw.mockCache.match.mockImplementation(async (target: string | Request) => {
      if (target === '/' || (typeof target === 'object' && 'url' in target && target.url === 'https://cadeapp.ar/')) {
        return new Response('<html><head><title>cadeApp Shell</title></head></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        });
      }
      return undefined;
    });

    const response = await sw.dispatchFetch(request);

    expect(response).not.toBeNull();
    expect(await response?.text()).toContain('cadeApp Shell');
    expect(sw.mockCache.put).toHaveBeenCalledTimes(0);
  });

  it('6. cross-origin → no se intercepta ni persiste', async () => {
    const externalUrls = [
      'https://api.mapbox.com/styles/v1',
      'https://fonts.googleapis.com/css',
      'https://cdn.jsdelivr.net/npm/something',
    ];

    for (const url of externalUrls) {
      const request = new Request(url);
      const response = await sw.dispatchFetch(request);

      expect(response).toBeNull();
      expect(sw.mockCache.put).not.toHaveBeenCalled();
    }
  });

  it('7. POST/PUT/DELETE/PATCH → métodos mutativos no se interceptan', async () => {
    const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];

    for (const method of methods) {
      const request = new Request('https://cadeapp.ar/brand/logo.svg', { method });
      const response = await sw.dispatchFetch(request);

      expect(response).toBeNull();
      expect(sw.mockCache.put).not.toHaveBeenCalled();
    }
  });

  it('8. install cachea los assets del shell y activate limpia cachés anteriores', async () => {
    await sw.dispatchInstall();
    expect(sw.mockCache.addAll).toHaveBeenCalledWith(
      expect.arrayContaining(['/', '/manifest.webmanifest', '/brand/logo.svg'])
    );

    await sw.dispatchActivate();
    expect(sw.mockCaches.delete).toHaveBeenCalledWith('cadeapp-shell-v0');
    expect(sw.mockCaches.delete).not.toHaveBeenCalledWith('cadeapp-shell-v1');
  });

  it('9. Mutación adversarial: un SW que persistiera todo GET violaría la política y fallaría', async () => {
    // Simular un SW con bug donde cualquier GET se intercepta y persiste
    const buggySwCode = `
      self.addEventListener('fetch', (event) => {
        if (event.request.method === 'GET') {
          event.respondWith(
            fetch(event.request).then((res) => {
              caches.open('cadeapp-shell-v1').then((c) => c.put(event.request, res.clone()));
              return res;
            })
          );
        }
      });
    `;

    const buggySw = createSWInstance(buggySwCode);
    const healthRequest = new Request('https://cadeapp.ar/api/health');
    buggySw.mockFetch.mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }));

    const res = await buggySw.dispatchFetch(healthRequest);

    // En el buggy SW, sí se interceptó y sí intentó persistir /api/health
    expect(res).not.toBeNull();
    expect(buggySw.mockCache.put).toHaveBeenCalledWith(healthRequest, expect.anything());

    // Mientras que en nuestra implementación protegida (sw real), no se intercepta ni persiste:
    const safeRes = await sw.dispatchFetch(healthRequest);
    expect(safeRes).toBeNull();
    expect(sw.mockCache.put).not.toHaveBeenCalled();
  });
});
