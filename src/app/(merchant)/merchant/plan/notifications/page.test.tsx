// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@/features/announcements', () => ({ setPromotionsOptInAction: vi.fn() }));
vi.mock('@/features/notifications/push/subscription', () => ({
  getNotificationPermission: () => 'default',
  getPushSubscriptionStatus: vi.fn().mockResolvedValue('inactive'),
  requestNotificationPermission: vi.fn(),
  subscribeToPush: vi.fn(),
  unsubscribeFromPush: vi.fn(),
}));

import { PUSH_COPY } from '@/features/notifications';
import MerchantNotificationsPage from './page';
import CourierProfileNotificationsPage from '../../../../(courier)/courier/profile/notifications/page';

describe('T-431: páginas de avisos de cada rol con el mismo componente', () => {
  afterEach(cleanup);

  it('la del comercio carga el componente con los textos del comercio', async () => {
    render(<MerchantNotificationsPage />);
    expect(await screen.findByText(PUSH_COPY.merchantPrompt.subtitle)).toBeTruthy();
    expect(screen.getByText(PUSH_COPY.merchantPrompt.benefitSpeedDesc)).toBeTruthy();
    expect(screen.queryByText(PUSH_COPY.prompt.subtitle)).toBeNull();
  });

  it('la del repartidor sigue con los textos del repartidor', async () => {
    render(<CourierProfileNotificationsPage />);
    expect(await screen.findByText(PUSH_COPY.prompt.subtitle)).toBeTruthy();
    expect(screen.queryByText(PUSH_COPY.merchantPrompt.subtitle)).toBeNull();
  });
});
