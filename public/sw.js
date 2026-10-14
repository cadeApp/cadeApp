const CACHE_NAME = 'cadeapp-shell-v2';

const STATIC_ASSETS = [
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

  // 4. Navegación HTML same-origin (Network-First con respuesta «Sin conexión», NUNCA persiste HTML dinámico)
  const isNavigation =
    request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Sin conexión</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="background:#12182C;color:#fff;font-family:sans-serif;padding:2rem;text-align:center;"><h1>Sin conexión</h1><p>No se pudo conectar a Internet. Verificá tu red y volvé a intentar.</p></body></html>',
          {
            status: 503,
            statusText: 'Offline',
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          }
        );
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

// Excepción acotada a Regla 25 (D03 = 3-A): el SW no puede importar Zod, así que replica a mano
// y de forma estricta `pushPayloadSchema` de src/server/push/sender.ts. Si ese schema cambia,
// este objeto y sus pruebas en src/app/sw.test.ts cambian en el mismo PR.
const PUSH_PAYLOAD_KEYS = {
  request_published: ['event', 'requestId'],
  offer_submitted: ['event', 'requestId', 'offerId'],
  offer_accepted: ['event', 'requestId', 'offerId'],
  request_cancelled: ['event', 'requestId'],
  request_expired: ['event', 'requestId'],
};

// Mismo patrón que z.string().uuid() (Zod 3).
const UUID_REGEX =
  /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

// Devuelve el payload validado o null. Cualquier clave extra, evento desconocido o UUID inválido
// invalida el payload completo.
function parsePushPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  const event = payload.event;
  if (typeof event !== 'string' || !Object.prototype.hasOwnProperty.call(PUSH_PAYLOAD_KEYS, event)) {
    return null;
  }
  const expectedKeys = PUSH_PAYLOAD_KEYS[event];
  const actualKeys = Object.keys(payload);
  if (
    actualKeys.length !== expectedKeys.length ||
    !expectedKeys.every((key) => actualKeys.includes(key))
  ) {
    return null;
  }
  if (!isUuid(payload.requestId)) {
    return null;
  }
  if (expectedKeys.includes('offerId')) {
    if (!isUuid(payload.offerId)) {
      return null;
    }
    return { event: event, requestId: payload.requestId, offerId: payload.offerId };
  }
  return { event: event, requestId: payload.requestId };
}

function getNotificationDataForEvent(rawPayload, baseOrigin) {
  const origin = baseOrigin || (self.location && self.location.origin) || 'https://cadeapp.ar';
  const icon = '/icons/icon-192.png';
  const badge = '/icons/icon-192.png';
  const payload = parsePushPayload(rawPayload);

  if (!payload) {
    return {
      title: 'cadeApp',
      body: 'Tenés una actualización en la aplicación.',
      icon: icon,
      badge: badge,
      data: { url: origin + '/login', event: 'unknown' },
    };
  }

  const event = payload.event;
  const requestId = payload.requestId;

  switch (event) {
    case 'request_published':
      return {
        title: 'Nueva solicitud disponible',
        body: 'Hay un nuevo envío disponible en Aguilares.',
        icon: icon,
        badge: badge,
        data: { url: origin + '/courier/feed', event: event, requestId: requestId },
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
          offerId: payload.offerId,
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
          offerId: payload.offerId,
        },
      };

    case 'request_cancelled':
      return {
        title: 'Solicitud cancelada',
        body: 'La solicitud de envío fue cancelada.',
        icon: icon,
        badge: badge,
        data: { url: origin + '/courier/feed', event: event, requestId: requestId },
      };

    case 'request_expired':
    default:
      return {
        title: 'Solicitud vencida',
        body: 'La solicitud de envío expiró sin confirmación.',
        icon: icon,
        badge: badge,
        data: { url: origin + '/courier/feed', event: event, requestId: requestId },
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
  let targetUrl = rawUrl || origin + '/login';

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

