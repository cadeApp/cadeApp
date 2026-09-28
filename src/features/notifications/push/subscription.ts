import { publicEnv } from '@/lib/env.public';
import type {
  PushOperationResult,
  PushPermissionStatus,
  RequestPermissionOptions,
} from './types';

export const PUSH_STORAGE_KEY = 'cadeapp_push_enabled';

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
    const existing = await registration.pushManager.getSubscription();

    // Idempotencia: si ya existe una suscripción activa, se reutiliza
    if (existing) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(PUSH_STORAGE_KEY, 'true');
      }
      return {
        ok: true,
        subscription: {
          endpoint: existing.endpoint,
        },
      };
    }

    const key = vapidPublicKey || publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) {
      return { ok: false, error: 'missing_vapid_key' };
    }

    const applicationServerKey = urlBase64ToUint8Array(key);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as unknown as BufferSource,
    });

    const subJson = subscription.toJSON();
    const p256dh = subJson.keys?.['p256dh'];
    const auth = subJson.keys?.['auth'];

    if (p256dh && auth) {
      // Sincronizar alta con backend
      try {
        await fetch('/api/push/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            p256dh,
            auth,
            platform: 'web',
          }),
        });
      } catch {
        // Best effort: si la red falla, la suscripción local se conserva y se reintentará
      }
    }

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
  if (!isPushSupported()) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(PUSH_STORAGE_KEY, 'false');
    }
    return { ok: true };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    // Idempotencia: si no hay suscripción, no hay nada que desuscribir
    if (!subscription) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(PUSH_STORAGE_KEY, 'false');
      }
      return { ok: true };
    }

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    // Notificar baja al backend
    try {
      await fetch('/api/push/subscriptions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });
    } catch {
      // Best-effort
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(PUSH_STORAGE_KEY, 'false');
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unsubscription_failed',
    };
  }
}
