// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MerchantsTable } from './merchants-table';
import { setMerchantSubscriptionAction } from '../actions';
import type { AdminMerchantsResult } from '../types';
import { formatDate } from '@/lib/format';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
  usePathname: () => '/admin/merchants',
}));

vi.mock('../actions', () => ({
  setMerchantSubscriptionAction: vi.fn(),
  getMerchantPlanMovementsAction: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}));

const MERCHANT_ID = 'f0000000-0000-4000-8000-00000000000a';

const COUNTS = { all: 22, pilot: 12, active: 5, expired: 2, cancelled: 3 } as const;

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
      createdAt: '2026-10-01T12:00:00+00:00',
      signupIncomplete: false,
    },
  ],
  pageSize: 20,
  nextCursor: `2026-10-01T12:00:00+00:00~${MERCHANT_ID}`,
  hasNextPage: true,
};

describe('T-123: MerchantsTable (A03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra las columnas aprobadas y ninguna de CUIT', () => {
    render(<MerchantsTable counts={COUNTS} result={result} />);

    const table = screen.getByRole('table');
    for (const header of [/comercio/i, /responsable/i, /tel[eé]fono/i, /barrio/i, /plan/i, /pagado hasta/i, /despachos/i]) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeTruthy();
    }
    expect(document.body.textContent ?? '').not.toMatch(/cuit/i);
    expect(document.body.textContent ?? '').not.toMatch(/liquidaci/i);
  });

  it('muestra los datos del comercio y sus despachos', () => {
    render(<MerchantsTable counts={COUNTS} result={result} />);
    expect(screen.getByText('Panadería La Espiga')).toBeTruthy();
    expect(screen.getByText('Rosa Díaz')).toBeTruthy();
    expect(screen.getByText('Centro')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('pagina con un link por cursor', () => {
    render(<MerchantsTable counts={COUNTS} result={result} />);
    const next = screen.getByRole('link', { name: /siguiente/i });
    // T-420: el cursor «fecha~id» va codificado (el + de la zona horaria no se convierte en espacio).
    expect(next.getAttribute('href')).toBe(
      `/admin/merchants?cursor=2026-10-01T12%3A00%3A00%2B00%3A00%7E${MERCHANT_ID}`
    );
  });

  it('T-420: muestra la fecha y hora de alta de cada comercio', () => {
    render(<MerchantsTable counts={COUNTS} result={result} />);
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: /alta/i })).toBeTruthy();
    expect(within(table).getByText(formatDate('2026-10-01T12:00:00+00:00'))).toBeTruthy();
  });

  it('T-369: cada comercio enlaza a sus créditos y la cabecera al catálogo de planes', () => {
    render(<MerchantsTable counts={COUNTS} result={result} />);
    expect(
      screen.getByRole('link', { name: 'Créditos y plan de Panadería La Espiga' }).getAttribute('href')
    ).toBe(`/admin/merchants/${MERCHANT_ID}/credits`);
    expect(screen.getByRole('link', { name: 'Catálogo de planes' }).getAttribute('href')).toBe('/admin/merchants/plans');
  });

  it('muestra un estado vacío cuando no hay comercios', () => {
    render(
      <MerchantsTable counts={COUNTS} result={{ items: [], pageSize: 20, nextCursor: null, hasNextPage: false }} />
    );
    expect(screen.queryByRole('link', { name: /siguiente/i })).toBeNull();
    expect(screen.getByText(/no hay comercios/i)).toBeTruthy();
  });

  /**
   * PR112-H01: el modo se elige de forma explícita dentro del Dialog. La opción puede exponerse
   * como radio (radiogroup) o como tab (Tabs de src/ui); en ambos casos debe quedar seleccionada.
   */
  function chooseMode(dialog: HTMLElement, name: RegExp): void {
    const option =
      within(dialog).queryByRole('radio', { name }) ?? within(dialog).getByRole('tab', { name });
    fireEvent.mouseDown(option);
    fireEvent.click(option);
    const selected =
      option.getAttribute('aria-checked') === 'true' ||
      option.getAttribute('aria-selected') === 'true';
    expect(selected).toBe(true);
  }

  async function openPlanDialog(): Promise<HTMLElement> {
    fireEvent.click(screen.getByRole('button', { name: /abono y piloto/i }));
    return screen.findByRole('dialog');
  }

  it('«Marcar mes pagado» activa la suscripción con paid_until (pilot → active)', async () => {
    vi.mocked(setMerchantSubscriptionAction).mockResolvedValue({
      ok: true,
      data: {
        merchantId: MERCHANT_ID,
        subscriptionStatus: 'active',
        paidUntil: '2026-10-31',
      },
    });
    render(<MerchantsTable counts={COUNTS} result={result} />);

    const dialog = await openPlanDialog();
    chooseMode(dialog, /marcar mes pagado/i);
    fireEvent.change(within(dialog).getByLabelText(/hasta/i), {
      target: { value: '2026-10-31' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(setMerchantSubscriptionAction).toHaveBeenCalledWith({
        merchantId: MERCHANT_ID,
        subscriptionStatus: 'active',
        paidUntil: '2026-10-31',
      });
    });
    expect(setMerchantSubscriptionAction).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('«Extender piloto» conserva subscriptionStatus pilot y fija paid_until', async () => {
    vi.mocked(setMerchantSubscriptionAction).mockResolvedValue({
      ok: true,
      data: {
        merchantId: MERCHANT_ID,
        subscriptionStatus: 'pilot',
        paidUntil: '2026-10-31',
      },
    });
    render(<MerchantsTable counts={COUNTS} result={result} />);

    const dialog = await openPlanDialog();
    chooseMode(dialog, /extender piloto/i);
    fireEvent.change(within(dialog).getByLabelText(/hasta/i), {
      target: { value: '2026-10-31' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(setMerchantSubscriptionAction).toHaveBeenCalledWith({
        merchantId: MERCHANT_ID,
        subscriptionStatus: 'pilot',
        paidUntil: '2026-10-31',
      });
    });
    expect(setMerchantSubscriptionAction).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('cierra «Abono y piloto» con Escape y devuelve el foco al botón que lo abrió', async () => {
    render(<MerchantsTable counts={COUNTS} result={result} />);

    const trigger = screen.getByRole('button', { name: /abono y piloto/i });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();

    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });
});

describe('T-401: comercio con el alta sin completar', () => {
  const incomplete: AdminMerchantsResult = {
    items: [
      {
        id: MERCHANT_ID,
        businessName: 'Alta sin completar',
        ownerName: 'Rosa Díaz',
        phone: '3865551234',
        pickupZoneName: null,
        subscriptionStatus: 'pilot',
        paidUntil: null,
        deliveredCount: 0,
        createdAt: '2026-10-01T12:00:00+00:00',
        signupIncomplete: true,
      },
    ],
    pageSize: 20,
    nextCursor: null,
    hasNextPage: false,
  };

  it('la celda «Comercio» muestra «Alta sin completar» como etiqueta secundaria y el nombre del responsable', () => {
    render(<MerchantsTable counts={COUNTS} result={incomplete} />);
    const [, merchantCell] = within(screen.getByRole('table')).getAllByRole('cell');
    if (!merchantCell) throw new Error('falta la celda del comercio');
    expect(within(merchantCell).queryByText('Rosa Díaz')).not.toBeNull();
    const label = within(merchantCell).queryByText('Alta sin completar');
    expect(label).not.toBeNull();
    expect(label?.className ?? '').toMatch(/text-muted-foreground/);
  });

  it('«Créditos y plan», «Abono y piloto» y el diálogo usan el texto de respaldo, nunca un nombre vacío', async () => {
    render(<MerchantsTable counts={COUNTS} result={incomplete} />);
    expect(screen.getByRole('link', { name: /créditos y plan de alta sin completar/i })).toBeTruthy();
    const edit = screen.getByRole('button', { name: /abono y piloto de alta sin completar/i });
    fireEvent.click(edit);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toMatch(/Alta sin completar$/);
  });
});

describe('T-405: chips de resumen y etiquetas de estado (A03)', () => {
  function chip(name: RegExp): HTMLElement {
    return within(screen.getByRole('navigation', { name: 'Filtrar por estado del plan' })).getByRole('link', {
      name,
    });
  }

  it('muestra «Todos», «Piloto», «Activos», «Vencidos» y «Cancelados» con su cantidad exacta', () => {
    render(<MerchantsTable counts={COUNTS} result={result} />);
    expect(chip(/^Todos/).textContent).toBe('Todos22');
    expect(chip(/^Piloto/).textContent).toBe('Piloto12');
    expect(chip(/^Activos/).textContent).toBe('Activos5');
    expect(chip(/^Vencidos/).textContent).toBe('Vencidos2');
    expect(chip(/^Cancelados/).textContent).toBe('Cancelados3');
  });

  it('cada chip filtra por ?status= y «Todos» vuelve sin filtro; el activo queda marcado', () => {
    render(<MerchantsTable counts={COUNTS} result={result} status="expired" />);
    expect(chip(/^Todos/).getAttribute('href')).toBe('/admin/merchants');
    expect(chip(/^Cancelados/).getAttribute('href')).toBe('/admin/merchants?status=cancelled');
    expect(chip(/^Vencidos/).getAttribute('aria-current')).toBe('page');
    expect(chip(/^Todos/).getAttribute('aria-current')).toBeNull();
  });

  it('la paginación conserva el chip activo', () => {
    render(<MerchantsTable counts={COUNTS} result={result} status="pilot" currentCursor="x" />);
    const next = new URL(screen.getByRole('link', { name: /siguiente/i }).getAttribute('href') ?? '', 'http://localhost');
    expect(next.searchParams.get('status')).toBe('pilot');
    expect(next.searchParams.get('cursor')).toBe(result.nextCursor);
    expect(screen.getByRole('link', { name: /volver al inicio/i }).getAttribute('href')).toBe(
      '/admin/merchants?status=pilot'
    );
  });

  it('«Piloto» usa el verde azulado de marca y «Activo» el color de éxito', () => {
    const active = { ...result.items[0], id: 'f0000000-0000-4000-8000-00000000000b', subscriptionStatus: 'active' as const };
    const [pilotItem] = result.items;
    if (!pilotItem) throw new Error('fixture vacío');
    render(<MerchantsTable counts={COUNTS} result={{ ...result, items: [pilotItem, { ...pilotItem, ...active }] }} />);
    const table = screen.getByRole('table');
    expect(within(table).getByText('Piloto').className).toMatch(/bg-primary /);
    expect(within(table).getByText('Activo').className).toMatch(/badge-success/);
  });
});
