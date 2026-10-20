export type PushPermissionStatus = NotificationPermission | 'unsupported';

/** T-382: estado real de los avisos de este navegador para la cuenta logueada. */
export type PushSubscriptionState = 'active' | 'inactive' | 'unknown';

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
