// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatArs } from '@/lib/format';
import { RequestCard } from './request-card';
import { OfferSheet } from './offer-sheet';
import type { AvailableRequestItem } from '../schemas';

vi.mock('../actions', () => ({
  submitOfferAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

const NOTES = 'Portón negro, tocar timbre 2B';
const CHANGE_AMOUNT = 5000;

const baseRequest: AvailableRequestItem = {
  id: '11111111-1111-1111-1111-111111111111',
  pickupZoneName: 'Centro',
  dropoffZoneName: 'Barrio Norte',
  approxDistanceKm: '2,5',
  packageType: 'small',
  recipientPaymentMethod: 'cash',
  needsChange: true,
  publishedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  expiresAt: new Date(Date.now() + 27 * 60 * 1000).toISOString(),
  hasMyOffer: false,
  myOfferAmountArs: null,
};

// La fuente puede traer los datos privados (por ejemplo una fila completa leída por API).
// Los lectores pre-match no deben mostrarlos aunque lleguen.
const sourceWithPrivateFields = {
  ...baseRequest,
  cashChangeAmount: CHANGE_AMOUNT,
  notes: NOTES,
};

function expectNoPrivateData(container: HTMLElement) {
  const text = container.textContent ?? '';
  expect(text).not.toContain('Indicaciones');
  expect(text).not.toContain(NOTES);
  expect(text).not.toContain(formatArs(CHANGE_AMOUNT));
}

describe('T-342 D3: el feed del repartidor no muestra datos privados antes del match', () => {
  afterEach(() => {
    cleanup();
  });

  it('RequestCard muestra el medio de pago y «Necesita cambio» sin monto ni indicaciones', () => {
    const { container } = render(
      <RequestCard request={sourceWithPrivateFields} onOfferClick={vi.fn()} />
    );

    expectNoPrivateData(container);
    expect(screen.getByText('Paga en efectivo')).toBeTruthy();
    expect(screen.getByText('Necesita cambio')).toBeTruthy();
  });

  it('OfferSheet muestra el medio de pago y «Necesita cambio» sin monto ni indicaciones', () => {
    render(
      <OfferSheet
        isOpen
        onClose={vi.fn()}
        request={sourceWithPrivateFields}
        minOfferArs={1000}
      />
    );

    expectNoPrivateData(document.body);
    expect(screen.getByText('Paga en efectivo')).toBeTruthy();
    expect(screen.getByText('Necesita cambio')).toBeTruthy();
  });
});
