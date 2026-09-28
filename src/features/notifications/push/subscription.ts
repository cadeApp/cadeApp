import { publicEnv } from '@/lib/env.public';
import type {
  PushOperationResult,
  PushPermissionStatus,
  RequestPermissionOptions,
} from './types';

export const PUSH_STORAGE_KEY = 'cadeapp_push_enabled';
export const PENDING_UNSUB_STORAGE_KEY = 'cadeapp_pending_unsub_endpoint';

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getNotificationPermission(): PushPermissionStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestNotificationPermission(
  options?: RequestPermissionOptions
): Promise<PushOperationResult> {
  // Invariante de plataforma: el permiso NUNCA se solicita sin un gesto explícito de usuario
  if (options?.isUserGesture !== true) {
    return {
      ok: false,
      error: 'gesture_required',
    };
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      ok: false,
      error: 'unsupported',
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      return {
        ok: true,
        permission,
      };
    }
    if (permission === 'denied') {
      return {
        ok: false,
        permission,
        error: 'permission_denied',
      };
    }
    return {
      ok: false,
      permission,
      error: 'permission_default',
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'permission_request_failed',
    };
  }
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function subscribeToPush(
  vapidPublicKey?: string
): Promise<PushOperationResult> {
  if (!isPushSupported()) {
    return { ok: false, error: 'unsupported' };
  }

  const currentPermission = getNotificationPermission();
  if (currentPermission !== 'granted') {
    return {
      ok: false,
      permission: currentPermission === 'unsupported' ? undefined : currentPermission,
      error: 'permission_not_granted',
    };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    // Si no existe suscripción nativa previa, solicitar alta en PushManager
    if (!subscription) {
      const key = vapidPublicKey || publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        return { ok: false, error: 'missing_vapid_key' };
      }

      const applicationServerKey = urlBase64ToUint8Array(key);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as unknown as BufferSource,
      });
    }

    const subJson = subscription.toJSON();
    const p256dh = subJson.keys?.['p256dh'];
    const auth = subJson.keys?.['auth'];

    // PR120-H03: suscripción sin claves criptográficas no es válida
    if (!p256dh || !auth) {
      return { ok: false, error: 'missing_keys' };
    }

    // PR120-H03: Sincronización obligatoria con backend (tanto para nueva como para preexistente)
    try {
      const response = await fetch('/api/push/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          p256dh,
          auth,
          platform: 'web',
        }),
      });

      if (!response.ok) {
        return {
          ok: false,
          error: response.status === 401 ? 'unauthorized' : 'backend_error',
        };
      }
    } catch {
      return {
        ok: false,
        error: 'network_error',
      };
    }

    // Sincronización con backend confirmada: marcar persistencia local
    if (typeof window !== 'undefined') {
      localStorage.setItem(PUSH_STORAGE_KEY, 'true');
    }

    return {
      ok: true,
      subscription: {
        endpoint: subscription.endpoint,
        p256dh,
        auth,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'subscription_failed',
    };
  }
}

export async function unsubscribeFromPush(): Promise<{ ok: boolean; error?: string }> {
  const pendingEndpoint =
    typeof window !== 'undefined'
      ? localStorage.getItem(PENDING_UNSUB_STORAGE_KEY)
      : null;

  if (!isPushSupported()) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(PUSH_STORAGE_KEY, 'false');
    }
    return { ok: true };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    const endpoint = subscription?.endpoint || pendingEndpoint;

    // Idempotencia: si no hay suscripción activa ni pendiente, no hay nada que desuscribir
    if (!endpoint) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(PUSH_STORAGE_KEY, 'false');
        localStorage.removeItem(PENDING_UNSUB_STORAGE_KEY);
      }
      return { ok: true };
    }

    // Si hay suscripción nativa, darla de baja en el navegador
    if (subscription) {
      try {
        await subscription.unsubscribe();
      } catch {
        // Continuar para reconciliar con backend
      }
    }

    // PR120-H05: Notificar baja al backend y confirmar status 200
    let deleteOk = false;
    let deleteStatus = 200;
    try {
      const response = await fetch('/api/push/subscriptions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });
      deleteOk = response.ok;
      deleteStatus = response.status;
    } catch {
      deleteOk = false;
    }

    if (!deleteOk) {
      // Retener endpoint para reintento en segunda llamada
      if (typeof window !== 'undefined') {
        localStorage.setItem(PENDING_UNSUB_STORAGE_KEY, endpoint);
      }
      return {
        ok: false,
        error: deleteStatus === 500 ? 'backend_error' : 'network_error',
      };
    }

    // Baja confirmada en backend: limpiar storage
    if (typeof window !== 'undefined') {
      localStorage.setItem(PUSH_STORAGE_KEY, 'false');
      localStorage.removeItem(PENDING_UNSUB_STORAGE_KEY);
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unsubscription_failed',
    };
  }
}
