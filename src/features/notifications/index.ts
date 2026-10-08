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

// D02: Exportación autorizada para T02 (Push Notifications)
import React from 'react';
import type { PushPermissionPromptProps } from './push/components/push-permission-prompt';

export type { PushPermissionPromptProps };

const LazyPrompt = React.lazy<React.ComponentType<PushPermissionPromptProps>>(() => {
  const comp = 'push-permission-prompt';
  return import(
    /* webpackChunkName: "push-prompt", webpackInclude: /push-permission-prompt\.tsx$/ */
    `./push/components/${comp}.tsx`
  ).then((m) => ({
    default: m.PushPermissionPrompt,
  }));
});

export const PushPermissionPrompt: React.FC<PushPermissionPromptProps> = (props) =>
  React.createElement(
    React.Suspense,
    { fallback: null },
    React.createElement(LazyPrompt as React.ComponentType<any>, props)
  );

export { PUSH_COPY } from './push/copy';

export const loadPushPermissionPrompt = () =>
  Promise.resolve({
    default: PushPermissionPrompt,
  });

export const isPushSupported = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
};

export const getNotificationPermission = (): import('./push/types').PushPermissionStatus => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as import('./push/types').PushPermissionStatus;
};

export const requestNotificationPermission: typeof import('./push/subscription').requestNotificationPermission =
  (...args) => {
    const sub = 'subscription';
    return import(
      /* webpackChunkName: "push-sub", webpackInclude: /subscription\.ts$/ */
      `./push/${sub}.ts`
    ).then((m) => m.requestNotificationPermission(...args));
  };

export const subscribeToPush: typeof import('./push/subscription').subscribeToPush =
  (...args) => {
    const sub = 'subscription';
    return import(
      /* webpackChunkName: "push-sub", webpackInclude: /subscription\.ts$/ */
      `./push/${sub}.ts`
    ).then((m) => m.subscribeToPush(...args));
  };

export const unsubscribeFromPush: typeof import('./push/subscription').unsubscribeFromPush =
  (...args) => {
    const sub = 'subscription';
    return import(
      /* webpackChunkName: "push-sub", webpackInclude: /subscription\.ts$/ */
      `./push/${sub}.ts`
    ).then((m) => m.unsubscribeFromPush(...args));
  };

export const getPushSubscription: typeof import('./push/subscription').getPushSubscription =
  (...args) => {
    const sub = 'subscription';
    return import(
      /* webpackChunkName: "push-sub", webpackInclude: /subscription\.ts$/ */
      `./push/${sub}.ts`
    ).then((m) => m.getPushSubscription(...args));
  };


