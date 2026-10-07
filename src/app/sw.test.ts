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
  mockShowNotification: ReturnType<typeof vi.fn>;
  mockOpenWindow: ReturnType<typeof vi.fn>;
  mockMatchAll: ReturnType<typeof vi.fn>;
  dispatchFetch: (request: Request) => Promise<Response | null>;
  dispatchInstall: () => Promise<void>;
  dispatchActivate: () => Promise<void>;
  dispatchPush: (payload: unknown) => Promise<void>;
  dispatchNotificationClick: (notificationData: unknown, action?: string) => Promise<{ closed: boolean }>;
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
    keys: vi.fn().mockResolvedValue(['cadeapp-shell-v0', 'cadeapp-shell-v1', 'cadeapp-shell-v2', 'other-cache']),
    delete: vi.fn().mockResolvedValue(true),
  };

  const mockFetch = vi.fn();

  const mockShowNotification = vi.fn().mockResolvedValue(undefined);
  const mockOpenWindow = vi.fn().mockImplementation(async (url: string) => ({ url, focus: vi.fn() }));
  const mockMatchAll = vi.fn().mockResolvedValue([]);

  const sandbox: Record<string, unknown> = {
    location: { origin: 'https://cadeapp.ar' },
    addEventListener: (type: string, fn: TestListener) => {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    skipWaiting: vi.fn().mockResolvedValue(undefined),
    registration: {
      showNotification: mockShowNotification,
    },
    clients: {
      claim: vi.fn().mockResolvedValue(undefined),
      openWindow: mockOpenWindow,
      matchAll: mockMatchAll,
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

  const dispatchPush = async (payload: unknown) => {
    let waitUntilPromise: Promise<unknown> | null = null;
    const event = {
      data: {
        json: () => payload,
        text: () => (typeof payload === 'string' ? payload : JSON.stringify(payload)),
      },
      waitUntil: (p: Promise<unknown>) => {
        waitUntilPromise = p;
      },
    };
    for (const listener of listeners['push'] || []) {
      listener(event);
    }
    if (waitUntilPromise) {
      await waitUntilPromise;
    }
  };

  const dispatchNotificationClick = async (notificationData: unknown, action?: string) => {
    let closed = false;
    let waitUntilPromise: Promise<unknown> | null = null;
    const event = {
      notification: {
        data: notificationData,
        close: () => {
          closed = true;
        },
      },
      action,
      waitUntil: (p: Promise<unknown>) => {
        waitUntilPromise = p;
      },
    };
    for (const listener of listeners['notificationclick'] || []) {
      listener(event);
    }
    if (waitUntilPromise) {
      await waitUntilPromise;
    }
    return { closed };
  };

  return {
    listeners,
    mockCache,
    mockCaches,
    mockFetch,
    mockShowNotification,
    mockOpenWindow,
    mockMatchAll,
    dispatchFetch,
    dispatchInstall,
    dispatchActivate,
    dispatchPush,
    dispatchNotificationClick,
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

  it('5. navegación /courier/feed con red caída → respuesta propia «Sin conexión» (HTML 503) y no la landing', async () => {
    const request = new Request('https://cadeapp.ar/courier/feed', {
      headers: { accept: 'text/html' },
    });

    sw.mockFetch.mockRejectedValue(new Error('Network error / offline'));

    const response = await sw.dispatchFetch(request);

    expect(response).not.toBeNull();
    expect(response?.status).toBe(503);
    const bodyText = await response?.text();
    expect(bodyText).toContain('Sin conexión');
    expect(bodyText).not.toContain('cadeApp Shell');
    expect(sw.mockCache.match).not.toHaveBeenCalledWith('/');
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

  it('8. install cachea los assets del shell (sin /) y activate limpia cachés anteriores incluyendo v1', async () => {
    await sw.dispatchInstall();
    expect(sw.mockCache.addAll).toHaveBeenCalledWith(
      expect.not.arrayContaining(['/'])
    );
    expect(sw.mockCache.addAll).toHaveBeenCalledWith(
      expect.arrayContaining(['/manifest.webmanifest', '/brand/logo.svg'])
    );

    await sw.dispatchActivate();
    expect(sw.mockCaches.delete).toHaveBeenCalledWith('cadeapp-shell-v0');
    expect(sw.mockCaches.delete).toHaveBeenCalledWith('cadeapp-shell-v1');
    expect(sw.mockCaches.delete).not.toHaveBeenCalledWith('cadeapp-shell-v2');
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

describe('T-202: Service Worker Push & NotificationClick Handlers (DoD Fase RED)', () => {
  let sw: SWContext;

  beforeEach(() => {
    sw = createSWInstance();
  });

  it('DoD: notificationclick abre un destino incorrecto (debe fallar si no abre la URL esperada del payload o abre destino incorrecto)', async () => {
    // Al recibir un click sobre una notificación de viaje, debe abrir /trips/[id]
    const targetUrl = 'https://cadeapp.ar/trips/10000000-0000-4000-8000-000000000001';
    const clickResult = await sw.dispatchNotificationClick({
      url: targetUrl,
      event: 'offer_accepted',
    });

    // Debe cerrar la notificación
    expect(clickResult.closed, 'notificationclick debe cerrar la notificación').toBe(true);

    // Debe abrir la ventana con el destino exacto (o hacer focus en cliente existente)
    expect(sw.mockOpenWindow, 'Debe invocar openWindow con el destino exacto').toHaveBeenCalledWith(targetUrl);
  });

  it('DoD: push procesa eventos sin leer datos personales y muestra notificación', async () => {
    // Payload estricto sin PII
    const pushPayload = {
      event: 'request_published',
      requestId: '10000000-0000-4000-8000-000000000001',
    };

    await sw.dispatchPush(pushPayload);

    // Debe invocar showNotification sin PII en title ni body
    expect(sw.mockShowNotification, 'El service worker debe escuchar el evento push y mostrar notificación').toHaveBeenCalledWith(
      expect.stringMatching(/solicitud|envío/i),
      expect.objectContaining({
        icon: expect.stringContaining('icon'),
        data: expect.objectContaining({
          url: expect.stringContaining('/courier/feed'),
        }),
      })
    );
  });

  it('DoD: los handlers se registran desde el service worker de T-201 sin duplicarse', () => {
    // Verificar que existen los listeners de push y notificationclick en el SW
    const pushListeners = sw.listeners['push'] || [];
    const clickListeners = sw.listeners['notificationclick'] || [];

    expect(pushListeners.length, 'Debe registrar exactamente 1 listener para push').toBe(1);
    expect(clickListeners.length, 'Debe registrar exactamente 1 listener para notificationclick').toBe(1);
  });
});


describe('PR120-H06 / H11: public/sw.js valida el contrato T-203 (pushPayloadSchema)', () => {
  const REQUEST_ID = '10000000-0000-4000-8000-000000000001';
  const OFFER_ID = '20000000-0000-4000-8000-000000000002';
  const FALLBACK_URL = 'https://cadeapp.ar/login';
  let sw: SWContext;

  beforeEach(() => {
    sw = createSWInstance();
  });

  async function pushAndGetUrl(payload: unknown): Promise<unknown> {
    await sw.dispatchPush(payload);
    expect(sw.mockShowNotification).toHaveBeenCalledTimes(1);
    const options = sw.mockShowNotification.mock.calls[0]?.[1] as { data?: { url?: unknown } };
    return options.data?.url;
  }

  it.each([
    [{ event: 'request_published', requestId: REQUEST_ID }, 'https://cadeapp.ar/courier/feed'],
    [
      { event: 'offer_submitted', requestId: REQUEST_ID, offerId: OFFER_ID },
      `https://cadeapp.ar/merchant/requests/${REQUEST_ID}`,
    ],
    [
      { event: 'offer_accepted', requestId: REQUEST_ID, offerId: OFFER_ID },
      `https://cadeapp.ar/trips/${REQUEST_ID}`,
    ],
    [{ event: 'request_cancelled', requestId: REQUEST_ID }, 'https://cadeapp.ar/courier/feed'],
    [{ event: 'request_expired', requestId: REQUEST_ID }, 'https://cadeapp.ar/courier/feed'],
  ])('evento válido %o → URL exacta %s', async (payload, expectedUrl) => {
    expect(await pushAndGetUrl(payload)).toBe(expectedUrl);
  });

  it('offer_submitted sin offerId → fallback', async () => {
    expect(await pushAndGetUrl({ event: 'offer_submitted', requestId: REQUEST_ID })).toBe(FALLBACK_URL);
  });

  it('offer_accepted sin offerId → fallback', async () => {
    expect(await pushAndGetUrl({ event: 'offer_accepted', requestId: REQUEST_ID })).toBe(FALLBACK_URL);
  });

  it('offerId inválido → fallback', async () => {
    expect(
      await pushAndGetUrl({ event: 'offer_accepted', requestId: REQUEST_ID, offerId: 'not-a-uuid' })
    ).toBe(FALLBACK_URL);
  });

  it.each(['recipient_name', 'phone', 'street_address', 'dni'])(
    'payload con clave extra de PII %s → fallback',
    async (piiKey) => {
      const url = await pushAndGetUrl({
        event: 'request_published',
        requestId: REQUEST_ID,
        [piiKey]: 'dato sensible',
      });
      expect(url).toBe(FALLBACK_URL);
      const [title, options] = sw.mockShowNotification.mock.calls[0] as [string, unknown];
      expect(JSON.stringify({ title, options })).not.toContain('dato sensible');
    }
  );

  it('evento desconocido → fallback', async () => {
    expect(await pushAndGetUrl({ event: 'trip_hacked', requestId: REQUEST_ID })).toBe(FALLBACK_URL);
  });

  it('array → fallback', async () => {
    expect(await pushAndGetUrl([{ event: 'request_published', requestId: REQUEST_ID }])).toBe(
      FALLBACK_URL
    );
  });

  it('T-338 DoD: notificationclick sin data.url abre /login', async () => {
    const clickResult = await sw.dispatchNotificationClick(null);
    expect(clickResult.closed).toBe(true);
    expect(sw.mockOpenWindow).toHaveBeenCalledWith('https://cadeapp.ar/login');
  });

  it('T-338 DoD: notificationclick con data sin url abre /login', async () => {
    const clickResult = await sw.dispatchNotificationClick({});
    expect(clickResult.closed).toBe(true);
    expect(sw.mockOpenWindow).toHaveBeenCalledWith('https://cadeapp.ar/login');
  });

  it('sigue habiendo exactamente 1 listener push y 1 notificationclick', () => {
    expect(sw.listeners['push']?.length).toBe(1);
    expect(sw.listeners['notificationclick']?.length).toBe(1);
  });
});
