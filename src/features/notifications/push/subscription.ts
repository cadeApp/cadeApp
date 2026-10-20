import { publicEnv } from '@/lib/env.public';
import { PendingUnsubEndpointSchema, PushStatusResponseSchema } from './schemas';
import type {
  PushOperationResult,
  PushPermissionStatus,
  PushSubscriptionState,
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

/** `name` y `message` de una excepción sin depender de `instanceof` (un `DOMException` puede venir de otro realm). */
function readErrorField(err: unknown, field: 'name' | 'message'): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const value: unknown = Reflect.get(err, field);
  return typeof value === 'string' ? value : undefined;
}

const REDACTED = '[redactado]';

/**
 * T-382 (PR459-H03): saca de un mensaje de error las URLs (el endpoint push es una URL de capacidad), los valores
 * `endpoint=`, `p256dh=` y `auth=`, y los secretos conocidos de la operación, si aparecen tal cual.
 */
export function sanitizePushErrorMessage(message: string, knownSecrets: readonly string[] = []): string {
  let sanitized = message;
  for (const secret of knownSecrets) {
    if (secret.length >= 4) {
      sanitized = sanitized.split(secret).join(REDACTED);
    }
  }
  return sanitized
    .replace(/\b(endpoint|p256dh|auth)\s*[=:]\s*[^\s,;]+/gi, `$1=${REDACTED}`)
    .replace(/[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi, REDACTED);
}

/**
 * T-382: diagnóstico de una falla de alta: el código y el `name` y `message` de la excepción original, con el mensaje
 * sanitizado. Nunca el objeto de error, la suscripción, el cuerpo del pedido ni las claves.
 */
/** Un `name` estándar (`AbortError`, `NotAllowedError`, `TypeError`…) se registra tal cual; cualquier otro, sanitizado. */
const STANDARD_ERROR_NAME = /^[A-Za-z][A-Za-z0-9]{0,63}$/;

function logSubscribeFailure(code: string, cause?: unknown, knownSecrets: readonly string[] = []) {
  const rawName = readErrorField(cause, 'name');
  const name =
    rawName === undefined || STANDARD_ERROR_NAME.test(rawName)
      ? rawName
      : sanitizePushErrorMessage(rawName, knownSecrets);
  const message = readErrorField(cause, 'message');
  console.error('[push] subscribe failed', {
    code,
    ...(name ? { name } : {}),
    ...(message !== undefined ? { message: sanitizePushErrorMessage(message, knownSecrets) } : {}),
  });
}

/**
 * Excepción del navegador antes de confirmar el alta (`serviceWorker.ready`, `getSubscription` o `subscribe`):
 * `NotAllowedError` es el permiso bloqueado (Edge); el resto, sin servicio push.
 */
function classifySubscribeException(err: unknown): 'permission_blocked' | 'push_service_unavailable' {
  return readErrorField(err, 'name') === 'NotAllowedError' ? 'permission_blocked' : 'push_service_unavailable';
}

/** Falla del navegador antes del alta: se clasifica, se registra sanitizada y no se llama al servidor. */
function browserSubscribeFailure(err: unknown): PushOperationResult {
  const code = classifySubscribeException(err);
  logSubscribeFailure(code, err);
  return { ok: false, error: code };
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

  // PR459-H02: las fallas del navegador antes del alta (service worker o suscripción existente) se clasifican por
  // origen; nunca se presentan como un error del servidor.
  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.ready;
  } catch (err) {
    return browserSubscribeFailure(err);
  }
  let subscription: PushSubscription | null;
  try {
    subscription = await registration.pushManager.getSubscription();
  } catch (err) {
    return browserSubscribeFailure(err);
  }

  try {
    // Si no existe suscripción nativa previa, solicitar alta en PushManager
    if (!subscription) {
      const key = vapidPublicKey || publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        return { ok: false, error: 'missing_vapid_key' };
      }

      const applicationServerKey = urlBase64ToUint8Array(key);
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as unknown as BufferSource,
        });
      } catch (err) {
        return browserSubscribeFailure(err);
      }
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
        const code = response.status === 401 ? 'unauthorized' : 'backend_error';
        logSubscribeFailure(code);
        return { ok: false, error: code };
      }
    } catch (err) {
      logSubscribeFailure('network_error', err, [subscription.endpoint, p256dh, auth]);
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
    // Fallas posteriores al alta del navegador (por ejemplo, el storage): un código estable, nunca el mensaje crudo.
    logSubscribeFailure('subscription_failed', err);
    return { ok: false, error: 'subscription_failed' };
  }
}

/** T-382 (PR459-H01): ¿quedó un endpoint válido esperando que el servidor confirme la baja? */
function hasPendingUnsubscribe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(PENDING_UNSUB_STORAGE_KEY);
    return raw !== null && PendingUnsubEndpointSchema.safeParse(raw).success;
  } catch {
    return false;
  }
}

/**
 * T-382: estado real de los avisos en este navegador para la cuenta logueada. `active` exige permiso concedido,
 * suscripción del navegador y confirmación del servidor; `PUSH_STORAGE_KEY` nunca alcanza. Si la consulta falla,
 * `unknown` (nunca `active`).
 */
export async function getPushSubscriptionStatus(): Promise<PushSubscriptionState> {
  // PR459-H04: una baja pendiente se informa aunque el navegador no tenga (o no pueda leer) su suscripción.
  const pending = hasPendingUnsubscribe();
  if (!isPushSupported()) {
    return pending ? 'pending_unsubscribe' : 'inactive';
  }
  if (getNotificationPermission() !== 'granted') {
    return pending ? 'pending_unsubscribe' : 'inactive';
  }

  let endpoint: string;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      return pending ? 'pending_unsubscribe' : 'inactive';
    }
    endpoint = subscription.endpoint;
  } catch {
    return pending ? 'pending_unsubscribe' : 'unknown';
  }

  try {
    const response = await fetch('/api/push/subscriptions/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });
    if (!response.ok) {
      return 'unknown';
    }
    const parsed = PushStatusResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return 'unknown';
    }
    return parsed.data.active ? 'active' : 'inactive';
  } catch {
    return 'unknown';
  }
}

/**
 * PR120-H05 / PR459-H04: confirma la baja en el servidor (`DELETE` con el endpoint solo en el cuerpo). Solo un 2xx
 * limpia el storage; si no, el endpoint queda pendiente para reintentar.
 */
async function confirmUnsubscribeOnServer(endpoint: string): Promise<{ ok: boolean; error?: string }> {
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
    if (typeof window !== 'undefined') {
      localStorage.setItem(PENDING_UNSUB_STORAGE_KEY, endpoint);
    }
    return {
      ok: false,
      error: deleteStatus === 500 ? 'backend_error' : 'network_error',
    };
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(PUSH_STORAGE_KEY, 'false');
    localStorage.removeItem(PENDING_UNSUB_STORAGE_KEY);
  }
  return { ok: true };
}

export async function unsubscribeFromPush(): Promise<{ ok: boolean; error?: string }> {
  const rawPendingEndpoint =
    typeof window !== 'undefined'
      ? localStorage.getItem(PENDING_UNSUB_STORAGE_KEY)
      : null;

  let pendingEndpoint: string | null = null;
  if (rawPendingEndpoint !== null) {
    const parsed = PendingUnsubEndpointSchema.safeParse(rawPendingEndpoint);
    if (!parsed.success) {
      localStorage.removeItem(PENDING_UNSUB_STORAGE_KEY);
      return { ok: false, error: 'invalid_pending_endpoint' };
    }
    pendingEndpoint = parsed.data;
  }

  if (!isPushSupported()) {
    // PR459-H04: sin soporte nativo no hay suscripción que bajar en el navegador, pero una baja pendiente se confirma.
    if (pendingEndpoint) {
      return confirmUnsubscribeOnServer(pendingEndpoint);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(PUSH_STORAGE_KEY, 'false');
    }
    return { ok: true };
  }

  let subscription: PushSubscription | null;
  try {
    const registration = await navigator.serviceWorker.ready;
    subscription = await registration.pushManager.getSubscription();
  } catch {
    // PR459-H04: si el navegador no deja leer la suscripción, la baja pendiente igual se confirma en el servidor.
    if (pendingEndpoint) {
      return confirmUnsubscribeOnServer(pendingEndpoint);
    }
    return { ok: false, error: 'unsubscription_failed' };
  }

  try {
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

    // PR120-H05: notificar la baja al backend y confirmar el 2xx (retiene el endpoint para reintentar si falla).
    return await confirmUnsubscribeOnServer(endpoint);
  } catch {
    return { ok: false, error: 'unsubscription_failed' };
  }
}
