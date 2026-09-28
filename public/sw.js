const CACHE_NAME = 'cadeapp-shell-v1';

const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/brand/logo.svg',
  '/brand/logo.webp',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/apple-touch-icon.png',
];

// Identifica si un recurso es un asset estático público persistible (shell o chunks de Next.js)
function isPersistableAsset(url) {
  if (STATIC_ASSETS.includes(url.pathname)) {
    return true;
  }
  if (url.pathname.startsWith('/_next/static/')) {
    return true;
  }
  return false;
}

// Rutas explícitamente excluidas de intercepción y persistencia
function isExcludedRoute(url) {
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/storage/') ||
    url.searchParams.has('_rsc')
  ) {
    return true;
  }
  return false;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => {
        const deletions = names
          .filter((name) => name.startsWith('cadeapp-shell-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name));
        return Promise.all(deletions);
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 1. Solo métodos GET
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 2. Solo same-origin
  if (url.origin !== self.location.origin) {
    return;
  }

  // 3. Rutas excluidas (APIs, Storage confidencial, RSC): nunca interceptar
  if (isExcludedRoute(url)) {
    return;
  }

  // 4. Navegación HTML same-origin (Network-First con fallback a /, NUNCA persiste HTML dinámico)
  const isNavigation =
    request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const shell = await cache.match('/');
        if (shell) {
          return shell;
        }
        return new Response('Sin conexión', { status: 503, statusText: 'Offline' });
      })
    );
    return;
  }

  // 5. Assets estáticos del shell y _next/static/** (Persistencia autorizada)
  if (isPersistableAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Cualquier otra petición no se intercepta para permitir el flujo natural de red
});
