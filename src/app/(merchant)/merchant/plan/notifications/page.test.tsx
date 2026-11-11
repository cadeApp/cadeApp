// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@/features/announcements', () => ({ setPromotionsOptInAction: vi.fn() }));
// H03 (ronda 1 de #688): el componente real, salvo que la prueba pida un fallo de render.
const failure = vi.hoisted(() => ({ throwOnRender: false }));
vi.mock('@/features/notifications/push/components/push-permission-prompt', async () => {
  const actual = await vi.importActual<typeof import('@/features/notifications/push/components/push-permission-prompt')>(
    '@/features/notifications/push/components/push-permission-prompt'
  );
  return {
    ...actual,
    PushPermissionPrompt: (props: React.ComponentProps<typeof actual.PushPermissionPrompt>) => {
      if (failure.throwOnRender) throw new Error('fallo simulado de render');
      return <actual.PushPermissionPrompt {...props} />;
    },
  };
});
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
  afterEach(() => {
    cleanup();
    failure.throwOnRender = false;
    vi.restoreAllMocks();
  });

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

  it.each([
    ['comercio', MerchantNotificationsPage],
    ['repartidor', CourierProfileNotificationsPage],
  ])('si el componente falla al renderizar, la página del %s muestra el aviso recuperable', async (_role, Page) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    failure.throwOnRender = true;
    render(<Page />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No se pudo cargar el control de notificaciones');
    expect(screen.getByRole('button', { name: 'Recargar la página' })).toBeTruthy();
  });
});
