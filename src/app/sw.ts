export const CACHE_NAME = 'cadeapp-shell-v1';

export const STATIC_ASSETS: string[] = [
  '/',
  '/manifest.webmanifest',
  '/brand/logo.svg',
  '/brand/logo.webp',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/icon-maskable-192x192.png',
  '/icon-maskable-512x512.png',
];

const NON_CACHEABLE_PATTERNS = [
  /\/api\/auth/,
  /\/api\/push/,
  /\/storage\/.*courier-docs/,
];

export function isCacheableRequest(request: Request): boolean {
  if (request.method !== 'GET') {
    return false;
  }

  const url = new URL(request.url);

  // Excluir endpoints sensibles / privados de cacheo
  if (NON_CACHEABLE_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    return false;
  }

  // Solo protocolos http / https
  if (!url.protocol.startsWith('http')) {
    return false;
  }

  return true;
}

export async function handleInstall(): Promise<void> {
  if (typeof caches === 'undefined') return;
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(STATIC_ASSETS);
}

export async function handleActivate(): Promise<void> {
  if (typeof caches === 'undefined') return;
  const cacheNames = await caches.keys();
  const oldCaches = cacheNames.filter(
    (name) => name.startsWith('cadeapp-shell-') && name !== CACHE_NAME
  );
  await Promise.all(oldCaches.map((name) => caches.delete(name)));
}

export async function handleFetch(request: Request): Promise<Response> {
  if (!isCacheableRequest(request)) {
    return fetch(request);
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200 && typeof caches !== 'undefined') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    if (typeof caches !== 'undefined') {
      let cachedResponse: Response | undefined = undefined;
      if (typeof caches.match === 'function') {
        cachedResponse = await caches.match(request);
      }
      if (!cachedResponse) {
        const cache = await caches.open(CACHE_NAME);
        cachedResponse = await cache.match(request);
      }
      if (cachedResponse) {
        return cachedResponse;
      }
      // Si la navegación es a un documento HTML y no hay red, fallback al shell
      if (
        request.headers.get('accept')?.includes('text/html') ||
        (request as { mode?: string }).mode === 'navigate'
      ) {
        const cache = await caches.open(CACHE_NAME);
        const shell = await cache.match('/');
        if (shell) return shell;
      }
    }
    throw error;
  }
}

// Registro de eventos en el contexto del Service Worker
if (typeof self !== 'undefined' && 'addEventListener' in self && 'clients' in self) {
  const sw = self as unknown as {
    addEventListener: (type: string, listener: (event: Event) => void) => void;
    skipWaiting: () => Promise<void>;
    clients: { claim: () => Promise<void> };
  };

  sw.addEventListener('install', (event: Event) => {
    (event as unknown as { waitUntil: (p: Promise<void>) => void }).waitUntil(
      handleInstall().then(() => sw.skipWaiting())
    );
  });

  sw.addEventListener('activate', (event: Event) => {
    (event as unknown as { waitUntil: (p: Promise<void>) => void }).waitUntil(
      handleActivate().then(() => sw.clients.claim())
    );
  });

  sw.addEventListener('fetch', (event: Event) => {
    (event as unknown as { respondWith: (p: Promise<Response>) => void }).respondWith(
      handleFetch((event as unknown as { request: Request }).request)
    );
  });
}
