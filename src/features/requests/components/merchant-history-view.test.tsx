// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { MerchantHistoryView } from './merchant-history-view';
import type { MerchantDropSummary, MerchantRequestSummary } from '../types';

function drop(position: number, status: 'delivered' | 'failed'): MerchantDropSummary {
  return {
    id: `drop-${position}`,
    position,
    dropoffZoneName: position === 1 ? 'Villa Nueva' : 'Independencia',
    packageType: 'chico',
    recipientPaymentMethod: 'transfer',
    needsChange: false,
    approxDistanceKm: null,
    status,
    deliveredAt: status === 'delivered' ? '2026-10-22T04:30:00Z' : null,
    failedReason: status === 'failed' ? 'El destinatario no responde' : null,
  };
}

function request(id: string, drops: MerchantDropSummary[]): MerchantRequestSummary {
  return {
    id,
    pickupZoneName: 'J. F. Kennedy',
    dropoffZoneName: 'Villa Nueva',
    approxDistanceKm: '3,5',
    packageType: 'chico',
    recipientPaymentMethod: 'transfer',
    needsChange: false,
    status: 'delivered',
    expiresAt: null,
    createdAt: '2026-10-22T04:00:00Z',
    offersCount: 1,
    acceptedOfferId: `offer-${id}`,
    acceptedAmountArs: 1200,
    acceptedCourierName: 'Mateo Sanchez',
    dropsCount: drops.length,
    drops,
  };
}

const card = (id: string) => {
  const link = screen.getAllByRole('link').find((el) => el.getAttribute('href') === `/merchant/requests/${id}`);
  if (!(link instanceof HTMLElement)) throw new Error(`No hay tarjeta para ${id}`);
  return link;
};

describe('T-393: historial del comercio con entregas parciales', () => {
  const partial = request('req-partial', [drop(1, 'delivered'), drop(2, 'failed')]);
  const none = request('req-none', [drop(1, 'failed'), drop(2, 'failed')]);
  const complete = request('req-complete', [drop(1, 'delivered'), drop(2, 'delivered')]);

  it('una solicitud parcial muestra «Entrega parcial · 1 de 2» y no «Entregada»', () => {
    render(<MerchantHistoryView requests={[partial]} />);

    const el = card('req-partial');
    expect(within(el).getByText('Entrega parcial · 1 de 2')).toBeDefined();
    expect(within(el).queryByText('Entregada')).toBeNull();
  });

  it('una solicitud sin ninguna entrega realizada muestra «No entregada»', () => {
    render(<MerchantHistoryView requests={[none]} />);

    const el = card('req-none');
    expect(within(el).getByText('No entregada')).toBeDefined();
    expect(within(el).queryByText('Entregada')).toBeNull();
  });

  it('una solicitud con todo entregado sigue mostrando «Entregada»', () => {
    render(<MerchantHistoryView requests={[complete]} />);

    expect(within(card('req-complete')).getByText('Entregada')).toBeDefined();
  });

  it('las parciales y las no entregadas siguen en la pestaña «Entregadas» (su estado es delivered)', () => {
    render(<MerchantHistoryView requests={[partial, none, complete]} activeStatus="delivered" />);

    expect(card('req-partial')).toBeDefined();
    expect(card('req-none')).toBeDefined();
    expect(card('req-complete')).toBeDefined();
  });
});
