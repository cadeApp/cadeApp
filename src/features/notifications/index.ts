export { isIosSafariNonStandalone } from './install/is-ios';
export { isStandalone } from './install/is-standalone';
export { StandaloneRedirect } from './install/standalone-redirect';
export { StandaloneBackLink } from './install/standalone-back-link';
export { useOfflineStatus } from './offline/use-offline-status';

export const loadOfflineBanner = () =>
  import('./offline/offline-banner').then((module) => ({
    default: module.OfflineBanner,
  }));

export const loadOfflineFloatingCard = () =>
  import('./offline/offline-banner').then((module) => ({
    default: module.OfflineFloatingCard,
  }));

export { loadIosInstallGuideSheet } from './install/standalone-redirect';

export const loadErrorView = () =>
  import('./offline/error-view').then((module) => ({
    default: module.ErrorView,
  }));

export const loadNotFoundView = () =>
  import('./offline/not-found-view').then((module) => ({
    default: module.NotFoundView,
  }));

// D02: Exportación autorizada para T02 (Push Notifications). T-426: el componente de clase y el lazy viven en un
// módulo cliente; este barrel lo importa not-found.tsx (Server Component) y React no tiene Component en el servidor.
export {
  PushPromptErrorBoundary,
  PushPermissionPrompt,
  loadPushPermissionPrompt,
} from './push/push-prompt-entry';
export type {
  PushPermissionPromptProps,
  PushPromptErrorBoundaryProps,
  PushPromptErrorBoundaryState,
} from './push/push-prompt-entry';

export { PUSH_COPY } from './push/copy';

export {
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSupported,
  getNotificationPermission,
  getPushSubscription,
} from './push/subscription';



