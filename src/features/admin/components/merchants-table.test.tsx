// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MerchantsTable } from './merchants-table';
import { setMerchantSubscriptionAction } from '../actions';
import type { AdminMerchantsResult } from '../types';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
  usePathname: () => '/admin/merchants',
}));

vi.mock('../actions', () => ({
  setMerchantSubscriptionAction: vi.fn(),
}));

const MERCHANT_ID = 'f0000000-0000-4000-8000-00000000000a';

const result: AdminMerchantsResult = {
  items: [
    {
      id: MERCHANT_ID,
      businessName: 'Panadería La Espiga',
      ownerName: 'Rosa Díaz',
      phone: '3865551234',
      pickupZoneName: 'Centro',
      subscriptionStatus: 'pilot',
      paidUntil: null,
      deliveredCount: 42,
    },
  ],
  pageSize: 20,
  nextCursor: MERCHANT_ID,
  hasNextPage: true,
};

describe('T-123: MerchantsTable (A03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra las columnas aprobadas y ninguna de CUIT', () => {
    render(<MerchantsTable result={result} />);

    const table = screen.getByRole('table');
    for (const header of [/comercio/i, /responsable/i, /tel[eé]fono/i, /barrio/i, /plan/i, /pagado hasta/i, /despachos/i]) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeTruthy();
    }
    expect(document.body.textContent ?? '').not.toMatch(/cuit/i);
    expect(document.body.textContent ?? '').not.toMatch(/liquidaci/i);
  });

  it('muestra los datos del comercio y sus despachos', () => {
    render(<MerchantsTable result={result} />);
    expect(screen.getByText('Panadería La Espiga')).toBeTruthy();
    expect(screen.getByText('Rosa Díaz')).toBeTruthy();
    expect(screen.getByText('Centro')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('pagina con un link por cursor', () => {
    render(<MerchantsTable result={result} />);
    const next = screen.getByRole('link', { name: /siguiente/i });
    expect(next.getAttribute('href')).toBe(`/admin/merchants?cursor=${MERCHANT_ID}`);
  });

  it('muestra un estado vacío cuando no hay comercios', () => {
    render(
      <MerchantsTable result={{ items: [], pageSize: 20, nextCursor: null, hasNextPage: false }} />
    );
    expect(screen.queryByRole('link', { name: /siguiente/i })).toBeNull();
    expect(screen.getByText(/no hay comercios/i)).toBeTruthy();
  });

  it('registra un pago manual con paid_until desde la hoja de edición', async () => {
    vi.mocked(setMerchantSubscriptionAction).mockResolvedValue({
      ok: true,
      data: { merchantId: MERCHANT_ID, subscriptionStatus: 'pilot', paidUntil: '2026-10-31' },
    });
    render(<MerchantsTable result={result} />);

    fireEvent.click(screen.getByRole('button', { name: /editar plan/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/pagado hasta/i), {
      target: { value: '2026-10-31' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(setMerchantSubscriptionAction).toHaveBeenCalledWith(
        expect.objectContaining({
          merchantId: MERCHANT_ID,
          subscriptionStatus: 'pilot',
          paidUntil: '2026-10-31',
        })
      );
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
