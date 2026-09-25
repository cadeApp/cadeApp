// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MyOffersList } from './my-offers-list';
import { OfferSheet } from './offer-sheet';
import type { AvailableRequestItem, CourierOfferItem } from '../schemas';

const mocks = vi.hoisted(() => ({
  submitOfferAction: vi.fn(),
  withdrawOfferAction: vi.fn(),
}));

vi.mock('../actions', () => ({
  submitOfferAction: mocks.submitOfferAction,
  withdrawOfferAction: mocks.withdrawOfferAction,
}));

vi.mock('@/ui/notify', () => {
  throw new Error('notify chunk failed');
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('PR87-R06: mutaciones de ofertas no dependen de notify', () => {
  const pendingOffer: CourierOfferItem = {
    offerId: 'offer-uuid-1',
    requestId: 'request-uuid-1',
    pickupZoneName: 'Centro',
    dropoffZoneName: 'Barrio Norte',
    amountArs: 1800,
    etaMinutes: 15,
    message: null,
    status: 'pending',
    createdAt: '2026-09-25T03:00:00Z',
    decidedAt: null,
    requestExpiresAt: '2026-09-25T04:00:00Z',
    approxDistanceKm: '2,5',
  };

  const availableRequest: AvailableRequestItem = {
    id: 'request-uuid-1',
    pickupZoneName: 'Centro',
    dropoffZoneName: 'Barrio Norte',
    approxDistanceKm: '2,5',
    packageType: 'small',
    recipientPaymentMethod: 'cash',
    needsChange: false,
    cashChangeAmount: null,
    notes: null,
    publishedAt: '2026-09-25T03:00:00Z',
    expiresAt: '2026-09-25T04:00:00Z',
    hasMyOffer: false,
    myOfferAmountArs: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('marca una oferta como retirada si la action tiene éxito aunque notify no cargue', async () => {
    mocks.withdrawOfferAction.mockResolvedValue({
      ok: true,
      data: { offerId: pendingOffer.offerId },
    });

    render(<MyOffersList initialOffers={[pendingOffer]} />);

    fireEvent.click(screen.getByRole('button', { name: /Retirar oferta/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Sí, retirar oferta/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Pendientes \(0\)/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Otras \(1\)/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Otras \(1\)/i }));
    expect(await screen.findByText('Retirada')).toBeDefined();
  });

  it('cierra la sheet tras enviar una oferta si la action tiene éxito aunque notify no cargue', async () => {
    mocks.submitOfferAction.mockResolvedValue({
      ok: true,
      data: { offerId: 'offer-uuid-2' },
    });
    const onClose = vi.fn();

    render(
      <OfferSheet isOpen={true} onClose={onClose} request={availableRequest} minOfferArs={1000} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Enviar oferta/i }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});
