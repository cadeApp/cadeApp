// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getMerchantAccountProfile: vi.fn(),
  getSubscriptionDisplay: vi.fn(),
  getMyPublicationBalance: vi.fn(),
  getPublicationOffer: vi.fn(),
}));

// Solo se simulan las lecturas del servidor: las secciones de saldo y de planes se renderizan con el componente real.
vi.mock('@/features/merchants/server', async () => ({
  PublicationBalanceSection: (
    await vi.importActual<typeof import('@/features/merchants/components/publication-balance-section')>(
      '@/features/merchants/components/publication-balance-section'
    )
  ).PublicationBalanceSection,
  PublicationOfferSection: (
    await vi.importActual<typeof import('@/features/merchants/components/publication-offer-section')>(
      '@/features/merchants/components/publication-offer-section'
    )
  ).PublicationOfferSection,
  getPublicationOffer: mocks.getPublicationOffer,
  buildSupportWhatsAppHref: (
    await vi.importActual<typeof import('@/features/merchants/support-whatsapp')>('@/features/merchants/support-whatsapp')
  ).buildSupportWhatsAppHref,
  getMerchantAccountProfile: mocks.getMerchantAccountProfile,
  getSubscriptionDisplay: mocks.getSubscriptionDisplay,
  getMyPublicationBalance: mocks.getMyPublicationBalance,
}));
vi.mock('@/features/auth/server', () => ({
  logoutAction: vi.fn(),
}));

import MerchantPlanPage from './page';

const EMPTY_OFFER = { plans: [], looseCreditReferencePriceArs: null, launchDiscountPct: null };

const PILOT_BALANCE = {
  merchantId: '20000000-0000-4000-8000-000000000369',
  mode: 'pilot',
  canPublish: true,
  subscriptionStatus: 'pilot',
  legacyPaidUntil: null,
  available: 0,
  reserved: 0,
  scheduled: 0,
  currentPeriod: null,
  nextPeriod: null,
  lots: [],
};

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
    mocks.getMyPublicationBalance.mockResolvedValue({ ok: true, data: PILOT_BALANCE });
    mocks.getPublicationOffer.mockResolvedValue({ ok: true, data: EMPTY_OFFER });
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

describe('T-369 / CC-029 — Mi plan usa get_my_publication_balance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMerchantAccountProfile.mockResolvedValue({
      businessName: 'Comercio de prueba',
      defaultPickupAddress: 'San Martín 100',
      zoneName: 'Centro',
      phone: '3865123456',
      notes: null,
      subscriptionStatus: 'active',
      paidUntil: '2026-11-30',
    });
    mocks.getPublicationOffer.mockResolvedValue({ ok: true, data: EMPTY_OFFER });
  });
  afterEach(cleanup);

  it('el estado del plan sale del saldo real, no del estado de suscripción', async () => {
    mocks.getMyPublicationBalance.mockResolvedValue({ ok: true, data: PILOT_BALANCE });
    render(await MerchantPlanPage());
    const section = screen.getByRole('region', { name: 'Mi plan' });
    expect(within(section).getByRole('heading', { name: 'Estás en el piloto gratis' })).toBeTruthy();
    expect(screen.queryByText('Envíos permitidos')).toBeNull();
    expect(mocks.getSubscriptionDisplay).not.toHaveBeenCalled();
  });

  it('si el saldo falla, el perfil sigue visible y el error se avisa en la sección', async () => {
    mocks.getMyPublicationBalance.mockResolvedValue({ ok: false, code: 'INTERNAL_ERROR' });
    render(await MerchantPlanPage());
    expect(screen.getByRole('heading', { name: 'Comercio de prueba' })).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Mi plan' })).getByRole('alert').textContent).toContain(
      'No pudimos cargar tu saldo de créditos'
    );
  });
});

describe('T-412 / CC-039 — Mi plan muestra los planes disponibles', () => {
  const originalNumber = process.env.CADEAPP_SUPPORT_WHATSAPP_NUMBER;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CADEAPP_SUPPORT_WHATSAPP_NUMBER = '+54 9 3865 123456';
    mocks.getMerchantAccountProfile.mockResolvedValue({
      businessName: 'Comercio de prueba',
      defaultPickupAddress: 'San Martín 100',
      zoneName: 'Centro',
      phone: '3865123456',
      notes: null,
      subscriptionStatus: 'active',
      paidUntil: null,
    });
    mocks.getMyPublicationBalance.mockResolvedValue({ ok: true, data: PILOT_BALANCE });
  });

  afterEach(() => {
    cleanup();
    if (originalNumber === undefined) delete process.env.CADEAPP_SUPPORT_WHATSAPP_NUMBER;
    else process.env.CADEAPP_SUPPORT_WHATSAPP_NUMBER = originalNumber;
  });

  it('lee la oferta y cada plan pide por el WhatsApp del soporte configurado', async () => {
    mocks.getPublicationOffer.mockResolvedValue({
      ok: true,
      data: {
        plans: [
          {
            planId: '00000000-0000-4000-8000-000000390001',
            name: 'Plan 40',
            kind: 'quota',
            monthlyCredits: 40,
            referencePriceArs: 20000,
          },
        ],
        looseCreditReferencePriceArs: null,
        launchDiscountPct: null,
      },
    });
    render(await MerchantPlanPage());
    expect(mocks.getPublicationOffer).toHaveBeenCalledTimes(1);
    const section = screen.getByRole('region', { name: 'Planes disponibles' });
    expect(within(section).getByRole('link', { name: 'Quiero este plan: Plan 40' }).getAttribute('href')).toBe(
      `https://wa.me/5493865123456?text=${encodeURIComponent(
        'Hola cadeApp, quiero contratar el plan «Plan 40» para mi comercio.'
      )}`
    );
  });

  it('si la oferta falla, el resto de la cuenta sigue visible', async () => {
    mocks.getPublicationOffer.mockResolvedValue({ ok: false, code: 'INTERNAL_ERROR' });
    render(await MerchantPlanPage());
    expect(screen.getByRole('heading', { name: 'Comercio de prueba' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Mi plan' })).toBeTruthy();
    const section = screen.getByRole('region', { name: 'Planes disponibles' });
    expect(within(section).getByRole('alert').textContent).toContain('No pudimos cargar los planes disponibles');
    expect(screen.getByRole('link', { name: 'Hablar con cadeApp' })).toBeTruthy();
  });
});
