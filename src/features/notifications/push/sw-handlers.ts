import { PUSH_COPY } from './copy';
import { PushNotificationPayloadSchema } from './schemas';
import type {
  NotificationActionData,
  NotificationEventLike,
  PushEventLike,
  ServiceWorkerClientLike,
  ServiceWorkerGlobalScopeLike,
} from './types';

export interface PushEventNotificationConfig {
  title: string;
  body: string;
  icon: string;
  badge: string;
  data: NotificationActionData;
}

export function getNotificationDataForEvent(
  payload: unknown,
  baseOrigin = 'https://cadeapp.ar'
): PushEventNotificationConfig {
  const icon = '/icons/icon-192.png';
  const badge = '/icons/icon-192.png';

  const parsed = PushNotificationPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      title: PUSH_COPY.notifications.fallbackTitle,
      body: PUSH_COPY.notifications.fallbackBody,
      icon,
      badge,
      data: { url: `${baseOrigin}/`, event: 'unknown' },
    };
  }

  const { event, requestId } = parsed.data;
  const offerId = 'offerId' in parsed.data ? parsed.data.offerId : undefined;

  switch (event) {
    case 'request_published':
      return {
        title: PUSH_COPY.notifications.requestPublishedTitle,
        body: PUSH_COPY.notifications.requestPublishedBody,
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
        title: PUSH_COPY.notifications.offerSubmittedTitle,
        body: PUSH_COPY.notifications.offerSubmittedBody,
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
        title: PUSH_COPY.notifications.offerAcceptedTitle,
        body: PUSH_COPY.notifications.offerAcceptedBody,
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
        title: PUSH_COPY.notifications.requestCancelledTitle,
        body: PUSH_COPY.notifications.requestCancelledBody,
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
        title: PUSH_COPY.notifications.requestExpiredTitle,
        body: PUSH_COPY.notifications.requestExpiredBody,
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
        title: PUSH_COPY.notifications.fallbackTitle,
        body: PUSH_COPY.notifications.fallbackUpdateBody,
        icon,
        badge,
        data: { url: `${baseOrigin}/`, event: 'unknown' },
      };
  }
}

export function handlePushEvent(event: PushEventLike, sw: ServiceWorkerGlobalScopeLike): void {
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

  const origin = sw.location?.origin || 'https://cadeapp.ar';
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

export function handleNotificationClickEvent(
  event: NotificationEventLike,
  sw: ServiceWorkerGlobalScopeLike
): void {
  if (event.notification && typeof event.notification.close === 'function') {
    event.notification.close();
  }

  const rawUrl = event.notification?.data?.url;
  const origin = sw.location?.origin || 'https://cadeapp.ar';
  let targetUrl = rawUrl || `${origin}/`;

  if (targetUrl.startsWith('/')) {
    targetUrl = `${origin}${targetUrl}`;
  }

  const clickPromise = sw.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList: readonly ServiceWorkerClientLike[]) => {
      // Si ya hay una ventana abierta en el mismo destino u origen, hacer focus
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      for (const client of clientList) {
        if ('focus' in client && client.navigate) {
          return client.navigate(targetUrl).then(() => client.focus());
        }
      }
      // Si no hay ventana abierta, abrir nueva ventana
      if (sw.clients.openWindow) {
        return sw.clients.openWindow(targetUrl);
      }
      return null;
    });

  if (event.waitUntil) {
    event.waitUntil(clickPromise);
  }
}

export function registerPushHandlers(sw: ServiceWorkerGlobalScopeLike): void {
  if (!sw || typeof sw.addEventListener !== 'function') {
    return;
  }

  // Prevenir registro duplicado de handlers
  if (sw.__cadeapp_push_registered) {
    return;
  }
  sw.__cadeapp_push_registered = true;

  sw.addEventListener('push', (event: unknown) => {
    handlePushEvent(event as PushEventLike, sw);
  });

  sw.addEventListener('notificationclick', (event: unknown) => {
    handleNotificationClickEvent(event as NotificationEventLike, sw);
  });
}
