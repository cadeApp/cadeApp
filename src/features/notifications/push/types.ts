import type { PushNotificationPayload } from './schemas';

export type { PushNotificationPayload };

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

export interface NotificationActionData {
  url: string;
  event: string;
  requestId?: string;
  offerId?: string;
}

export interface PushMessageDataLike {
  json(): unknown;
  text(): string;
  arrayBuffer(): ArrayBuffer;
  blob(): Blob;
}

export interface PushEventLike {
  readonly data: PushMessageDataLike | null;
  waitUntil(promise: Promise<unknown>): void;
}

export interface NotificationEventLike {
  readonly notification: {
    readonly data?: {
      readonly url?: string;
      readonly event?: string;
      readonly requestId?: string;
      readonly offerId?: string;
    };
    close(): void;
  };
  readonly action?: string;
  waitUntil(promise: Promise<unknown>): void;
}

export interface ServiceWorkerClientLike {
  readonly url: string;
  focus(): Promise<ServiceWorkerClientLike | null>;
  navigate?(url: string): Promise<ServiceWorkerClientLike | null>;
}

export interface ServiceWorkerClientsLike {
  matchAll(options?: {
    type?: 'window' | 'worker' | 'sharedworker' | 'all';
    includeUncontrolled?: boolean;
  }): Promise<readonly ServiceWorkerClientLike[]>;
  openWindow(url: string): Promise<ServiceWorkerClientLike | null>;
}

export interface ServiceWorkerRegistrationLike {
  showNotification(
    title: string,
    options?: {
      body?: string;
      icon?: string;
      badge?: string;
      data?: unknown;
      tag?: string;
    }
  ): Promise<void>;
}

export interface ServiceWorkerGlobalScopeLike {
  readonly location?: { readonly origin: string };
  readonly registration: ServiceWorkerRegistrationLike;
  readonly clients: ServiceWorkerClientsLike;
  addEventListener(type: string, listener: (event: unknown) => void): void;
  __cadeapp_push_registered?: boolean;
}
