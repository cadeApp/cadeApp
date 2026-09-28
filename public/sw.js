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

// --- Push Notifications & Notification Click Handlers (T-202) ---

function getNotificationDataForEvent(payload, baseOrigin) {
  const origin = baseOrigin || (self.location && self.location.origin) || 'https://cadeapp.ar';
  const icon = '/icons/icon-192.png';
  const badge = '/icons/icon-192.png';

  if (!payload || typeof payload !== 'object') {
    return {
      title: 'cadeApp',
      body: 'Tenés una nueva notificación en cadeApp.',
      icon: icon,
      badge: badge,
      data: { url: origin + '/', event: 'unknown' },
    };
  }

  const event = typeof payload.event === 'string' ? payload.event : '';
  const requestId = typeof payload.requestId === 'string' ? payload.requestId : '';
  const offerId = typeof payload.offerId === 'string' ? payload.offerId : undefined;

  // Validación básica UUID v4 RFC 4122
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(requestId)) {
    return {
      title: 'cadeApp',
      body: 'Tenés una actualización en la aplicación.',
      icon: icon,
      badge: badge,
      data: { url: origin + '/', event: 'unknown' },
    };
  }

  switch (event) {
    case 'request_published':
      return {
        title: 'Nueva solicitud disponible',
        body: 'Hay un nuevo envío disponible en Aguilares.',
        icon: icon,
        badge: badge,
        data: {
          url: origin + '/courier/feed',
          event: event,
          requestId: requestId,
        },
      };

    case 'offer_submitted':
      return {
        title: 'Nueva oferta recibida',
        body: 'Un repartidor envió una oferta para tu pedido.',
        icon: icon,
        badge: badge,
        data: {
          url: origin + '/merchant/requests/' + requestId,
          event: event,
          requestId: requestId,
          offerId: offerId,
        },
      };

    case 'offer_accepted':
      return {
        title: '¡Oferta aceptada!',
        body: 'Se confirmó la oferta para el envío.',
        icon: icon,
        badge: badge,
        data: {
          url: origin + '/trips/' + requestId,
          event: event,
          requestId: requestId,
          offerId: offerId,
        },
      };

    case 'request_cancelled':
      return {
        title: 'Solicitud cancelada',
        body: 'La solicitud de envío fue cancelada.',
        icon: icon,
        badge: badge,
        data: {
          url: origin + '/courier/feed',
          event: event,
          requestId: requestId,
        },
      };

    case 'request_expired':
      return {
        title: 'Solicitud vencida',
        body: 'La solicitud de envío expiró sin confirmación.',
        icon: icon,
        badge: badge,
        data: {
          url: origin + '/courier/feed',
          event: event,
          requestId: requestId,
        },
      };

    default:
      return {
        title: 'cadeApp',
        body: 'Tenés una actualización en la aplicación.',
        icon: icon,
        badge: badge,
        data: { url: origin + '/', event: 'unknown' },
      };
  }
}

self.addEventListener('push', (event) => {
  let payload = null;
  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch {
    try {
      payload = event.data ? JSON.parse(event.data.text()) : null;
    } catch {
      payload = null;
    }
  }

  const origin = (self.location && self.location.origin) || 'https://cadeapp.ar';
  const config = getNotificationDataForEvent(payload, origin);

  const promise = self.registration.showNotification(config.title, {
    body: config.body,
    icon: config.icon,
    badge: config.badge,
    data: config.data,
  });

  if (event.waitUntil) {
    event.waitUntil(promise);
  }
});

self.addEventListener('notificationclick', (event) => {
  if (event.notification && typeof event.notification.close === 'function') {
    event.notification.close();
  }

  const rawUrl =
    event.notification && event.notification.data ? event.notification.data.url : null;
  const origin = (self.location && self.location.origin) || 'https://cadeapp.ar';
  let targetUrl = rawUrl || origin + '/';

  if (targetUrl.startsWith('/')) {
    targetUrl = origin + targetUrl;
  }

  const clickPromise = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      for (const client of clientList) {
        if ('focus' in client && 'navigate' in client) {
          return client.navigate(targetUrl).then(() => client.focus());
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return null;
    });

  if (event.waitUntil) {
    event.waitUntil(clickPromise);
  }
});

