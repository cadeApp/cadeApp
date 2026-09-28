const CACHE_NAME = 'cadeapp-shell-v1';

const STATIC_ASSETS = [
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

function isCacheableRequest(request) {
  if (request.method !== 'GET') {
    return false;
  }
  const url = new URL(request.url);
  if (NON_CACHEABLE_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    return false;
  }
  if (!url.protocol.startsWith('http')) {
    return false;
  }
  return true;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      const deletions = names
        .filter((name) => name.startsWith('cadeapp-shell-') && name !== CACHE_NAME)
        .map((name) => caches.delete(name));
      return Promise.all(deletions);
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (!isCacheableRequest(event.request)) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.headers.get('accept')?.includes('text/html') || event.request.mode === 'navigate') {
          const shell = await caches.match('/');
          if (shell) return shell;
        }
        return new Response('Sin conexión', { status: 503, statusText: 'Offline' });
      })
  );
});
