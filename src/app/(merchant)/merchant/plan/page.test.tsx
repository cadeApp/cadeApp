// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getMerchantAccountProfile: vi.fn(),
  getSubscriptionDisplay: vi.fn(),
}));

vi.mock('@/features/merchants/server', () => ({
  getMerchantAccountProfile: mocks.getMerchantAccountProfile,
  getSubscriptionDisplay: mocks.getSubscriptionDisplay,
}));
vi.mock('@/features/auth/server', () => ({
  logoutAction: vi.fn(),
}));

import MerchantPlanPage from './page';

describe('T-368 — Mi plan: textos reales, términos publicados y WhatsApp configurable', () => {
  const originalNumber = process.env.CADEAPP_SUPPORT_WHATSAPP_NUMBER;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CADEAPP_SUPPORT_WHATSAPP_NUMBER;
    mocks.getMerchantAccountProfile.mockResolvedValue({
      businessName: 'Comercio de prueba',
      defaultPickupAddress: 'San Martín 100',
      zoneName: 'Centro',
      phone: '3865123456',
      notes: null,
      subscriptionStatus: 'pilot',
      paidUntil: null,
    });
    mocks.getSubscriptionDisplay.mockReturnValue({
      badgeVariant: 'published',
      badgeLabel: 'Piloto',
      headline: 'Etapa inicial bonificada',
      description: 'Piloto gratuito',
      untilLabel: 'Sin vencimiento registrado',
    });
  });

  afterEach(() => {
    cleanup();
    if (originalNumber === undefined) delete process.env.CADEAPP_SUPPORT_WHATSAPP_NUMBER;
    else process.env.CADEAPP_SUPPORT_WHATSAPP_NUMBER = originalNumber;
  });

  async function renderPage() {
    render(await MerchantPlanPage());
  }

  it('elimina el término flete y el aviso obsoleto, y enlaza los términos existentes', async () => {
    await renderPage();
    expect(screen.getByText('El pago del envío')).toBeTruthy();
    expect(screen.getByText(/cadeApp no procesa ese pago/)).toBeTruthy();
    expect(screen.queryByText(/flete/i)).toBeNull();
    expect(screen.queryByText(/documento legal en publicación/i)).toBeNull();
    expect(screen.getByRole('link', { name: 'Términos y condiciones del Piloto' }).getAttribute('href'))
      .toBe('/legal/pilot');
    expect(screen.getByText(/Cuando finalice el piloto/)).toBeTruthy();
    expect(screen.queryByText(/abono mensual fijo/i)).toBeNull();
  });

  it('usa el teléfono de soporte configurado y un mensaje codificado sin datos de usuario', async () => {
    process.env.CADEAPP_SUPPORT_WHATSAPP_NUMBER = '+54 9 3865 123456';
    await renderPage();
    const link = screen.getByRole('link', { name: 'Hablar con cadeApp' });
    expect(link.getAttribute('href'))
      .toBe('https://wa.me/5493865123456?text=Hola%20cadeApp%2C%20quiero%20consultar%20sobre%20los%20planes%20para%20comercios.');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it.each([undefined, '', 'numero-mal-formado', '+54 9 3865 123', '5493865123', '+54 9 3865 12345'])(
    'sin número válido (%s), no genera un enlace WhatsApp sin destinatario',
    async (number) => {
      if (number === undefined) delete process.env.CADEAPP_SUPPORT_WHATSAPP_NUMBER;
      else process.env.CADEAPP_SUPPORT_WHATSAPP_NUMBER = number;
      await renderPage();
      expect(screen.queryByRole('link', { name: 'Hablar con cadeApp' })).toBeNull();
      expect((screen.getByRole('button', { name: 'Hablar con cadeApp' }) as HTMLButtonElement).disabled)
        .toBe(true);
      expect(screen.getByRole('status').textContent).toContain('no está disponible');
    }
  );
});
