'use client';

import * as React from 'react';

export interface PushPermissionPromptProps {
  onSuccess?: () => void;
  onDismiss?: () => void;
  className?: string;
}

// Stub inicial para fase RED: T02 no existe aún
export const PushPermissionPrompt: React.FC<PushPermissionPromptProps> | undefined = undefined;

export interface RequestPermissionOptions {
  isUserGesture?: boolean;
}

export interface PushOperationResult {
  ok: boolean;
  permission?: NotificationPermission;
  error?: string;
}

// Stub inicial para fase RED: no valida el gesto
export async function requestNotificationPermission(
  _options?: RequestPermissionOptions
): Promise<PushOperationResult> {
  return { ok: true, permission: 'granted' };
}

// Stub inicial para fase RED: no implementado
export async function subscribeToPush(_vapidKey?: string): Promise<{
  ok: boolean;
  subscription?: unknown;
  error?: string;
}> {
  return { ok: false, error: 'not_implemented' };
}

// Stub inicial para fase RED: no elimina suscripción
export async function unsubscribeFromPush(): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: 'not_implemented' };
}

export function isPushSupported(): boolean {
  return false;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  return 'default';
}
