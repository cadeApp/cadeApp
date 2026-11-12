// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/features/announcements', () => ({ setPromotionsOptInAction: vi.fn() }));
vi.mock('../subscription', () => ({
  getNotificationPermission: () => 'default',
  getPushSubscriptionStatus: vi.fn().mockResolvedValue('inactive'),
  requestNotificationPermission: vi.fn(),
  subscribeToPush: vi.fn(),
  unsubscribeFromPush: vi.fn(),
}));

import { PUSH_COPY } from '../copy';
import { requestNotificationPermission, subscribeToPush } from '../subscription';
import { PushPermissionPrompt, type PushPromptCopy } from './push-permission-prompt';

describe('T-431: PushPermissionPrompt según quién lo usa', () => {
  afterEach(cleanup);

  it('sin copy muestra los textos del repartidor', () => {
    render(<PushPermissionPrompt embedded />);
    expect(screen.getByText(PUSH_COPY.prompt.subtitle)).toBeTruthy();
    expect(screen.getByText(PUSH_COPY.prompt.benefitSpeedDesc)).toBeTruthy();
  });

  it('con los textos del comercio los muestra y no queda ninguno del repartidor', () => {
    render(<PushPermissionPrompt embedded copy={PUSH_COPY.merchantPrompt} />);
    expect(screen.getByText(PUSH_COPY.merchantPrompt.subtitle)).toBeTruthy();
    expect(screen.getByText(PUSH_COPY.merchantPrompt.benefitSpeedDesc)).toBeTruthy();
    expect(screen.queryByText(PUSH_COPY.prompt.subtitle)).toBeNull();
    expect(screen.queryByText(/viajes/)).toBeNull();
  });

  // H04 (ronda 1 de #688): cada causa de falla del alta usa el texto de `copy`, no el genérico.
  it.each<[string, keyof PushPromptCopy]>([
    ['push_service_unavailable', 'statusPushServiceUnavailable'],
    ['permission_blocked', 'statusPermissionBlocked'],
    ['unauthorized', 'statusSessionExpired'],
    ['network_error', 'statusNetworkError'],
    ['missing_vapid_key', 'statusConfigError'],
    ['missing_keys', 'statusConfigError'],
    ['unsupported', 'statusUnsupported'],
    ['subscription_failed', 'statusGenericError'],
    ['otro_codigo', 'statusSubscriptionError'],
  ])('con el alta fallida por %s muestra el texto de copy.%s', async (code, key) => {
    vi.mocked(requestNotificationPermission).mockResolvedValue({ ok: true } as Awaited<
      ReturnType<typeof requestNotificationPermission>
    >);
    vi.mocked(subscribeToPush).mockResolvedValue({ ok: false, error: code } as Awaited<
      ReturnType<typeof subscribeToPush>
    >);
    render(<PushPermissionPrompt embedded copy={{ [key]: 'Error personalizado de prueba' }} />);
    fireEvent.click(screen.getByRole('button', { name: PUSH_COPY.prompt.btnActivate }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Error personalizado de prueba');
    expect(alert.textContent).not.toContain(PUSH_COPY.prompt[key]);
  });
});
