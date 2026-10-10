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

export interface PushPromptErrorBoundaryProps {
  children?: React.ReactNode;
  fallback?: React.ReactNode;
  onReload?: () => void;
}

export interface PushPromptErrorBoundaryState {
  hasError: boolean;
}

export class PushPromptErrorBoundary extends React.Component<
  PushPromptErrorBoundaryProps,
  PushPromptErrorBoundaryState
> {
  constructor(props: PushPromptErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): PushPromptErrorBoundaryState {
    return { hasError: true };
  }

  private handleReload = () => {
    if (this.props.onReload) {
      this.props.onReload();
    } else if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
      window.location.reload();
    }
  };

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ??
        React.createElement(
          'div',
          {
            role: 'alert',
            className:
              'mx-auto max-w-md rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-center text-sm text-foreground',
          },
          React.createElement(
            'p',
            { className: 'font-medium' },
            'No se pudo cargar el control de notificaciones.'
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: this.handleReload,
              className:
                'mt-2 inline-flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90',
            },
            'Recargar la página'
          )
        )
      );
    }
    return this.props.children;
  }
}

const PushPromptLoadingFallback: React.FC<{ embedded?: boolean }> = ({ embedded }) =>
  React.createElement(
    'div',
    {
      className: embedded
        ? 'h-64 w-full rounded-2xl bg-muted/60 animate-pulse'
        : 'mx-auto max-w-md p-6',
      'aria-busy': 'true',
      'aria-label': 'Cargando notificaciones',
    },
    React.createElement('div', {
      className: 'h-64 w-full rounded-2xl bg-muted/60 animate-pulse',
    })
  );

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
    PushPromptErrorBoundary,
    null,
    React.createElement(
      React.Suspense,
      {
        fallback: React.createElement(PushPromptLoadingFallback, {
          embedded: props.embedded,
        }),
      },
      React.createElement(LazyPrompt, props)
    )
  );

export { PUSH_COPY } from './push/copy';

export const loadPushPermissionPrompt = () =>
  Promise.resolve({
    default: PushPermissionPrompt,
  });

export {
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSupported,
  getNotificationPermission,
  getPushSubscription,
} from './push/subscription';



