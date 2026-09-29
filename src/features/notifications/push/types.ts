export type PushPermissionStatus = NotificationPermission | 'unsupported';

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
