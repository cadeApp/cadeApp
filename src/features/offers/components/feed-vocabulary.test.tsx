// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PACKAGE_TYPES, RECIPIENT_PAYMENT_METHODS } from '@/domain';
import type { PackageType, RecipientPaymentMethod } from '@/domain';
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

const PACKAGE_LABELS: Record<PackageType, string> = {
  sobre: 'Sobre',
  chico: 'Paquete chico',
  mediano: 'Paquete mediano',
  grande: 'Paquete grande',
};

const PAYMENT_LABELS: Record<RecipientPaymentMethod, string> = {
  cash: 'Paga en efectivo',
  transfer: 'Paga con transferencia',
  to_agree: 'A coordinar',
};

const NOW = '2026-09-26T12:00:00.000Z';

function makeRequest(
  packageType: PackageType,
  recipientPaymentMethod: RecipientPaymentMethod
): AvailableRequestItem {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    pickupZoneName: 'Centro',
    dropoffZoneName: 'Barrio Norte',
    approxDistanceKm: '2,5',
    packageType,
    recipientPaymentMethod,
    needsChange: false,
    publishedAt: NOW,
    expiresAt: null,
    hasMyOffer: false,
    myOfferAmountArs: null,
  };
}

function renderSurfaces(request: AvailableRequestItem): string[] {
  const card = render(<RequestCard request={request} onOfferClick={vi.fn()} />);
  const cardText = card.container.textContent ?? '';
  cleanup();
  render(<OfferSheet isOpen onClose={vi.fn()} request={request} minOfferArs={1000} />);
  const sheetText = document.body.textContent ?? '';
  cleanup();
  return [cardText, sheetText];
}

describe('T-343: el feed del repartidor usa el vocabulario canónico', () => {
  afterEach(() => {
    cleanup();
  });

  it.each(PACKAGE_TYPES)('muestra la etiqueta correcta del paquete «%s» en la tarjeta y en la hoja', (packageType) => {
    for (const text of renderSurfaces(makeRequest(packageType, 'cash'))) {
      expect(text).toContain(PACKAGE_LABELS[packageType]);
      for (const other of PACKAGE_TYPES.filter((p) => p !== packageType)) {
        expect(text).not.toContain(PACKAGE_LABELS[other]);
      }
    }
  });

  it.each(RECIPIENT_PAYMENT_METHODS)('muestra la etiqueta correcta del medio de pago «%s» en la tarjeta y en la hoja', (method) => {
    for (const text of renderSurfaces(makeRequest('chico', method))) {
      expect(text).toContain(PAYMENT_LABELS[method]);
      for (const other of RECIPIENT_PAYMENT_METHODS.filter((m) => m !== method)) {
        expect(text).not.toContain(PAYMENT_LABELS[other]);
      }
    }
  });

  it('to_agree se ve «A coordinar» y nunca «Transferencia»', () => {
    for (const text of renderSurfaces(makeRequest('grande', 'to_agree'))) {
      expect(text).toContain('A coordinar');
      expect(text).not.toMatch(/transferencia/i);
    }
  });

});
