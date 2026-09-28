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
  urlBase64ToUint8Array,
  PUSH_STORAGE_KEY,
} from './subscription';

export {
  registerPushHandlers,
  handlePushEvent,
  handleNotificationClickEvent,
  getNotificationDataForEvent,
  type PushEventNotificationConfig,
} from './sw-handlers';

export type {
  PushOperationResult,
  PushPermissionStatus,
  RequestPermissionOptions,
  PushSubscriptionRecord,
  PushNotificationPayload,
  NotificationActionData,
} from './types';
