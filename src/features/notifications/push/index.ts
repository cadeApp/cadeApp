'use client';

export {
  PushPermissionPrompt,
  type PushPermissionPromptProps,
} from './components/push-permission-prompt';

export {
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSupported,
  getNotificationPermission,
  getPushSubscription,
  getPushSubscriptionStatus,
  urlBase64ToUint8Array,
  PUSH_STORAGE_KEY,
  PENDING_UNSUB_STORAGE_KEY,
} from './subscription';

export type {
  PushOperationResult,
  PushPermissionStatus,
  PushSubscriptionState,
  RequestPermissionOptions,
  PushSubscriptionRecord,
} from './types';
