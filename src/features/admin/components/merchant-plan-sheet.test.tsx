// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MerchantPlanSheet } from './merchant-plan-sheet';
import { getMerchantPlanMovementsAction, setMerchantSubscriptionAction } from '../actions';
import type { AdminMerchantListItem, AuditLogItem } from '../types';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
  usePathname: () => '/admin/merchants',
}));

vi.mock('../actions', () => ({
  setMerchantSubscriptionAction: vi.fn(),
  getMerchantPlanMovementsAction: vi.fn(),
}));

const MERCHANT_ID = 'f0000000-0000-4000-8000-000000000405';

const merchant: AdminMerchantListItem = {
  id: MERCHANT_ID,
  businessName: 'Panadería La Espiga',
  ownerName: 'Rosa Díaz',
  phone: '3865551234',
  pickupZoneName: 'Centro',
  subscriptionStatus: 'pilot',
  paidUntil: '2026-11-30',
  deliveredCount: 42,
  createdAt: '2026-10-01T12:00:00+00:00',
  signupIncomplete: false,
};

function movement(id: number, overrides: Partial<AuditLogItem> = {}): AuditLogItem {
  return {
    id,
    createdAt: '2026-11-05T15:00:00.000Z',
    actorName: 'Lautaro',
    action: 'admin_set_subscription',
    targetType: 'merchant',
    targetRef: 'f0000000',
    targetName: 'Panadería La Espiga',
    changes: [{ field: 'subscription_status', before: 'pilot', after: 'active' }],
    reason: null,
    ...overrides,
  };
}

function renderSheet(onClose = vi.fn()) {
  render(<MerchantPlanSheet merchant={merchant} onClose={onClose} />);
  return { dialog: screen.getByRole('dialog'), onClose };
}

describe('T-405: MerchantPlanSheet (panel lateral de A03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMerchantPlanMovementsAction).mockResolvedValue({ ok: true, data: [] });
  });

  it('se abre a la derecha con el comercio, su contacto, los dos modos y la nota de pagos', async () => {
    const { dialog } = renderSheet();
    expect(dialog.getAttribute('data-sheet-side')).toBe('right');
    const contact = within(dialog).getByRole('region', { name: 'Contacto' });
    expect(within(contact).getByText('Panadería La Espiga')).toBeTruthy();
    expect(within(contact).getByText('Rosa Díaz')).toBeTruthy();
    expect(within(contact).getByText(/3865/)).toBeTruthy();
    expect(within(dialog).getByRole('radio', { name: 'Marcar mes pagado' })).toBeTruthy();
    expect(within(dialog).getByRole('radio', { name: 'Extender piloto' })).toBeTruthy();
    expect(within(dialog).getByText('No se registran montos ni comprobantes de pago en cadeApp.')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Guardar' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeTruthy();
    await waitFor(() => expect(getMerchantPlanMovementsAction).toHaveBeenCalled());
  });

  it('guarda con la RPC actual, avisa y refresca', async () => {
    vi.mocked(setMerchantSubscriptionAction).mockResolvedValue({
      ok: true,
      data: { merchantId: MERCHANT_ID, subscriptionStatus: 'pilot', paidUntil: '2026-12-31' },
    });
    const { dialog, onClose } = renderSheet();
    fireEvent.change(within(dialog).getByLabelText('Piloto hasta'), { target: { value: '2026-12-31' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(setMerchantSubscriptionAction).toHaveBeenCalledWith({
        merchantId: MERCHANT_ID,
        subscriptionStatus: 'pilot',
        paidUntil: '2026-12-31',
      })
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('muestra el error de la RPC dentro del panel y no lo cierra', async () => {
    vi.mocked(setMerchantSubscriptionAction).mockResolvedValue({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
    const { dialog, onClose } = renderSheet();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('pide los movimientos del comercio abierto y los muestra con fecha, qué cambió y quién', async () => {
    vi.mocked(getMerchantPlanMovementsAction).mockResolvedValue({
      ok: true,
      data: [movement(17), movement(16, { action: 'admin_register_plan_period', actorName: null, changes: [] })],
    });
    const { dialog } = renderSheet();

    const list = await within(dialog).findByRole('list', { name: 'Últimos movimientos' });
    expect(getMerchantPlanMovementsAction).toHaveBeenCalledWith({ merchantId: MERCHANT_ID });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toMatch(/Cambió el plan/);
    expect(items[0]?.textContent).toMatch(/Piloto/);
    expect(items[0]?.textContent).toMatch(/Activo/);
    expect(items[0]?.textContent).toMatch(/por Lautaro/);
    expect(items[0]?.querySelector('time')?.getAttribute('dateTime')).toBe('2026-11-05T15:00:00.000Z');
    expect(items[1]?.textContent).toMatch(/Registró un período de plan/);
    expect(items[1]?.textContent).toMatch(/por Sistema/);
  });

  it('mientras carga muestra un skeleton y sin movimientos lo dice', async () => {
    const { dialog } = renderSheet();
    expect(within(dialog).getByRole('status', { name: 'Cargando los últimos movimientos' })).toBeTruthy();
    expect(await within(dialog).findByText('Todavía no hay cambios de plan registrados.')).toBeTruthy();
  });

  it('si la lectura falla lo avisa con texto', async () => {
    vi.mocked(getMerchantPlanMovementsAction).mockResolvedValue({ ok: false, code: 'INTERNAL_ERROR' });
    const { dialog } = renderSheet();
    expect(await within(dialog).findByText('No pudimos cargar los últimos movimientos.')).toBeTruthy();
  });

  it('«Ver todo en Auditoría» lleva el targetId del comercio', async () => {
    const { dialog } = renderSheet();
    const href = within(dialog).getByRole('link', { name: 'Ver todo en Auditoría' }).getAttribute('href') ?? '';
    const url = new URL(href, 'http://localhost');
    expect(url.pathname).toBe('/admin/audit');
    expect(url.searchParams.get('target')).toBe(MERCHANT_ID);
    expect(url.searchParams.get('entity')).toBe('merchant');
    await waitFor(() => expect(getMerchantPlanMovementsAction).toHaveBeenCalled());
  });
});
