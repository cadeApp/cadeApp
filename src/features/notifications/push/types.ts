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

export interface PushNotificationPayload {
  event: 'request_published' | 'offer_submitted' | 'offer_accepted' | 'request_cancelled' | 'request_expired';
  requestId: string;
  offerId?: string;
}

export interface NotificationActionData {
  url: string;
  event: string;
  requestId?: string;
  offerId?: string;
}
