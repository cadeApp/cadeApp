export type PushPermissionStatus = NotificationPermission | 'unsupported';

/**
 * T-382: estado real de los avisos de este navegador para la cuenta logueada. `pending_unsubscribe`: el navegador ya
 * no tiene la suscripción, pero el servidor todavía no confirmó la baja (queda un endpoint pendiente de reintento).
 */
export type PushSubscriptionState = 'active' | 'inactive' | 'unknown' | 'pending_unsubscribe';

export interface PushOperationResult {
  ok: boolean;
  permission?: NotificationPermission;
  subscription?: PushSubscriptionRecord | null;
  error?: string;
}

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh?: string;
  auth?: string;
}

export interface RequestPermissionOptions {
  isUserGesture?: boolean;
}
