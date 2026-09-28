export interface PushEventNotificationConfig {
  title: string;
  body: string;
  icon: string;
  badge: string;
  data: {
    url: string;
    event?: string;
    requestId?: string;
    offerId?: string;
  };
}

export function getNotificationDataForEvent(
  payload: unknown,
  baseOrigin = 'https://cadeapp.ar'
): PushEventNotificationConfig {
  const icon = '/icons/icon-192.png';
  const badge = '/icons/icon-192.png';

  if (!payload || typeof payload !== 'object') {
    return {
      title: 'cadeApp',
      body: 'Tenés una nueva notificación en cadeApp.',
      icon,
      badge,
      data: { url: `${baseOrigin}/` },
    };
  }

  const p = payload as Record<string, unknown>;
  const event = typeof p['event'] === 'string' ? p['event'] : '';
  const requestId = typeof p['requestId'] === 'string' ? p['requestId'] : '';
  const offerId = typeof p['offerId'] === 'string' ? p['offerId'] : undefined;

  switch (event) {
    case 'request_published':
      return {
        title: 'Nueva solicitud disponible',
        body: 'Hay un nuevo envío disponible en Aguilares.',
        icon,
        badge,
        data: {
          url: `${baseOrigin}/courier/feed`,
          event,
          requestId,
        },
      };

    case 'offer_submitted':
      return {
        title: 'Nueva oferta recibida',
        body: 'Un repartidor envió una oferta para tu pedido.',
        icon,
        badge,
        data: {
          url: requestId
            ? `${baseOrigin}/merchant/requests/${requestId}`
            : `${baseOrigin}/merchant/dashboard`,
          event,
          requestId,
          offerId,
        },
      };

    case 'offer_accepted':
      return {
        title: '¡Oferta aceptada!',
        body: 'Se confirmó la oferta para el envío.',
        icon,
        badge,
        data: {
          url: requestId
            ? `${baseOrigin}/trips/${requestId}`
            : `${baseOrigin}/courier/offers`,
          event,
          requestId,
          offerId,
        },
      };

    case 'request_cancelled':
      return {
        title: 'Solicitud cancelada',
        body: 'La solicitud de envío fue cancelada.',
        icon,
        badge,
        data: {
          url: `${baseOrigin}/courier/feed`,
          event,
          requestId,
        },
      };

    case 'request_expired':
      return {
        title: 'Solicitud vencida',
        body: 'La solicitud de envío expiró sin confirmación.',
        icon,
        badge,
        data: {
          url: `${baseOrigin}/courier/feed`,
          event,
          requestId,
        },
      };

    default:
      return {
        title: 'cadeApp',
        body: 'Tenés una actualización en la aplicación.',
        icon,
        badge,
        data: { url: `${baseOrigin}/` },
      };
  }
}

export function handlePushEvent(event: any, sw: any): void {
  let payload: unknown = null;
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

  const origin = (sw.location && sw.location.origin) || 'https://cadeapp.ar';
  const config = getNotificationDataForEvent(payload, origin);

  const promise = sw.registration.showNotification(config.title, {
    body: config.body,
    icon: config.icon,
    badge: config.badge,
    data: config.data,
  });

  if (event.waitUntil) {
    event.waitUntil(promise);
  }
}

export function handleNotificationClickEvent(event: any, sw: any): void {
  if (event.notification && typeof event.notification.close === 'function') {
    event.notification.close();
  }

  const rawUrl = event.notification?.data?.url;
  const origin = (sw.location && sw.location.origin) || 'https://cadeapp.ar';
  let targetUrl = rawUrl || `${origin}/`;

  if (targetUrl.startsWith('/')) {
    targetUrl = `${origin}${targetUrl}`;
  }

  const clickPromise = sw.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList: any[]) => {
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
      if (sw.clients.openWindow) {
        return sw.clients.openWindow(targetUrl);
      }
      return null;
    });

  if (event.waitUntil) {
    event.waitUntil(clickPromise);
  }
}

export function registerPushHandlers(sw: any): void {
  if (!sw || typeof sw.addEventListener !== 'function') {
    return;
  }

  if (sw.__cadeapp_push_registered) {
    return;
  }
  sw.__cadeapp_push_registered = true;

  sw.addEventListener('push', (event: any) => {
    handlePushEvent(event, sw);
  });

  sw.addEventListener('notificationclick', (event: any) => {
    handleNotificationClickEvent(event, sw);
  });
}

// Autoregistro cuando se ejecuta en el contexto del Service Worker
if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  registerPushHandlers(self);
}
