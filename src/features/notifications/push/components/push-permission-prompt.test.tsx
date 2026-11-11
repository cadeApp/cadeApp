// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@/features/announcements', () => ({ setPromotionsOptInAction: vi.fn() }));
vi.mock('../subscription', () => ({
  getNotificationPermission: () => 'default',
  getPushSubscriptionStatus: vi.fn().mockResolvedValue('inactive'),
  requestNotificationPermission: vi.fn(),
  subscribeToPush: vi.fn(),
  unsubscribeFromPush: vi.fn(),
}));

import { PUSH_COPY } from '../copy';
import { PushPermissionPrompt } from './push-permission-prompt';

describe('T-431: PushPermissionPrompt según quién lo usa', () => {
  afterEach(cleanup);

  it('sin audience muestra los textos del repartidor', () => {
    render(<PushPermissionPrompt embedded />);
    expect(screen.getByText(PUSH_COPY.prompt.subtitle)).toBeTruthy();
    expect(screen.getByText(PUSH_COPY.prompt.benefitSpeedDesc)).toBeTruthy();
  });

  it('con audience="merchant" muestra los textos del comercio y ninguno del repartidor', () => {
    render(<PushPermissionPrompt embedded audience="merchant" />);
    expect(screen.getByText(PUSH_COPY.merchantPrompt.subtitle)).toBeTruthy();
    expect(screen.getByText(PUSH_COPY.merchantPrompt.benefitSpeedDesc)).toBeTruthy();
    expect(screen.queryByText(PUSH_COPY.prompt.subtitle)).toBeNull();
    expect(screen.queryByText(/viajes/)).toBeNull();
  });
});
