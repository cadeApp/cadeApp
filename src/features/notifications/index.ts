export { isIosSafariNonStandalone } from './install/is-ios';
export { useOfflineStatus } from './offline/use-offline-status';

export const loadOfflineBanner = () =>
  import('./offline/offline-banner').then((module) => ({
    default: module.OfflineBanner,
  }));

export const loadOfflineFloatingCard = () =>
  import('./offline/offline-banner').then((module) => ({
    default: module.OfflineFloatingCard,
  }));

export const loadIosInstallGuideSheet = () =>
  import('./install/ios-install-guide-sheet').then((module) => ({
    default: module.IosInstallGuideSheet,
  }));

export const loadErrorView = () =>
  import('./offline/error-view').then((module) => ({
    default: module.ErrorView,
  }));

export const loadNotFoundView = () =>
  import('./offline/not-found-view').then((module) => ({
    default: module.NotFoundView,
  }));

// D02: Exportación autorizada para T02 (Push Notifications)
export {
  PushPermissionPrompt,
  type PushPermissionPromptProps,
} from './push/components/push-permission-prompt';

export const loadPushPermissionPrompt = () =>
  import('./push/components/push-permission-prompt').then((module) => ({
    default: module.PushPermissionPrompt,
  }));

export {
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSupported,
  getNotificationPermission,
  getPushSubscription,
} from './push/subscription';
