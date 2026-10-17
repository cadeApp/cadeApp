// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { RpcOutput } from '@/domain';
import { getDomainErrorMessage } from '@/lib/error-messages';
import { MerchantCreditsView } from './merchant-credits-view';
import type { PublicationPlanItem } from '../types';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  grant: vi.fn(),
  register: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));
vi.mock('../actions', () => ({
  grantPublicationCreditsAction: mocks.grant,
  registerPlanPeriodAction: mocks.register,
}));
vi.mock('@/ui/notify', () => ({ notify: { success: mocks.notifySuccess, error: mocks.notifyError, info: vi.fn() } }));

const MERCHANT = { id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', businessName: 'Kiosco Centro' };
const PLAN_ACTIVE: PublicationPlanItem = {
  id: 'f0000000-0000-4000-8000-000000000001',
  code: 'plan-40',
  name: 'Plan 40',
  kind: 'quota',
  monthlyCredits: 40,
  referencePriceArs: 20000,
  active: true,
  sort: 1,
};
const PLAN_INACTIVE: PublicationPlanItem = { ...PLAN_ACTIVE, id: 'f0000000-0000-4000-8000-000000000002', name: 'Plan viejo', active: false };

const DATA: RpcOutput<'admin_get_merchant_publication_credits'> = {
  balance: {
    merchantId: MERCHANT.id,
    mode: 'credits',
    canPublish: true,
    subscriptionStatus: 'expired',
    legacyPaidUntil: null,
    available: 6,
    reserved: 1,
    scheduled: 40,
    currentPeriod: {
      periodId: 'f1000000-0000-4000-8000-000000000001',
      planId: PLAN_ACTIVE.id,
      planName: 'Plan 40',
      planKind: 'quota',
      monthlyCredits: 40,
      startsAt: '2026-10-10T15:00:00.000Z',
      endsAt: '2026-11-10T15:00:00.000Z',
      streak: 2,
      carryoverPct: 5,
    },
    nextPeriod: null,
    lots: [
      { lotId: 'f2000000-0000-4000-8000-000000000001', kind: 'plan', source: 'plan', granted: 40, available: 5, startsAt: '2026-10-10T15:00:00.000Z', expiresAt: '2026-11-10T15:00:00.000Z', usable: true },
      { lotId: 'f2000000-0000-4000-8000-000000000002', kind: 'loose', source: 'refund_conversion', granted: 1, available: 1, startsAt: null, expiresAt: null, usable: true },
    ],
  },
  movements: [
    { id: 12, kind: 'grant', amount: 40, lotId: null, chargeId: null, requestId: null, actorId: null, reason: 'plan', createdAt: '2026-10-10T15:00:00.000Z' },
    { id: 11, kind: 'convert', amount: 1, lotId: null, chargeId: null, requestId: null, actorId: null, reason: null, createdAt: '2026-10-09T15:00:00.000Z' },
  ],
  nextCursor: 11,
};

function renderView(overrides: Partial<React.ComponentProps<typeof MerchantCreditsView>> = {}) {
  render(
    <MerchantCreditsView merchant={MERCHANT} data={DATA} plans={[PLAN_ACTIVE, PLAN_INACTIVE]} currentBeforeId={null} {...overrides} />
  );
}

const grantOk = (idempotent: boolean, launchDiscountPct: number | null) => ({
  ok: true as const,
  data: { lotId: PLAN_ACTIVE.id, merchantId: MERCHANT.id, credits: 10, source: 'purchase' as const, launchDiscountPct, idempotent },
});

describe('T-369 / CC-029 — créditos de un comercio (admin)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('muestra saldo, período, lotes y libro tal como los devuelve la RPC, con paginado por cursor', () => {
    renderView();
    expect(screen.getByRole('heading', { name: 'Créditos de Kiosco Centro' })).toBeTruthy();
    expect(screen.getByText('Plan 40: del 10/10/2026 12:00 al 10/11/2026 12:00')).toBeTruthy();
    expect(screen.getByText(/Racha 2 · arrastre 5 %/)).toBeTruthy();
    const lots = within(screen.getByRole('table', { name: 'Lotes de créditos con saldo' })).getAllByRole('row').slice(1);
    expect(lots.map((row) => row.textContent)).toEqual(['Plan5 / 4010/11/2026 12:00', 'Devolución1 / 1No vence']);
    const movements = within(screen.getByRole('table', { name: 'Movimientos de créditos' })).getAllByRole('row').slice(1);
    expect(movements.map((row) => row.textContent)).toEqual(['10/10/2026 12:00Alta40plan', '09/10/2026 12:00Conversión a suelto1—']);
    const nav = screen.getByRole('navigation', { name: 'Paginación del libro' });
    expect(within(nav).getByRole('link', { name: 'Movimientos anteriores' }).getAttribute('href')).toBe(
      `/admin/merchants/${MERCHANT.id}/credits?before=11`
    );
    expect(within(nav).queryByRole('link', { name: 'Volver a los más recientes' })).toBeNull();
  });

  it('acreditar: valida, pide confirmación y reintenta el mismo payload con la misma clave', async () => {
    mocks.grant.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(grantOk(true, 0));
    renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Acreditar créditos' }));
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText('Cantidad de créditos'), { target: { value: '0' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }));
    expect(await within(dialog).findByText('Ingresá una cantidad entera de créditos entre 1 y 10.000.')).toBeTruthy();
    expect(mocks.grant).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText('Cantidad de créditos'), { target: { value: '10' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }));
    expect(
      await screen.findByText('Vas a acreditar 10 créditos sueltos a Kiosco Centro como «Compra confirmada fuera de la app».')
    ).toBeTruthy();
    expect(mocks.grant).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByText('Esa operación ya estaba registrada: no se acreditó dos veces.', { selector: 'p' });

    const [first, second] = mocks.grant.mock.calls.map((call) => call[0]);
    expect(first).toEqual({ merchantId: MERCHANT.id, credits: 10, source: 'purchase', note: null, operationKey: expect.any(String) });
    expect(second.operationKey).toBe(first.operationKey);
    expect(screen.getByText('Primera compra: se registró el beneficio de lanzamiento con 0 %.')).toBeTruthy();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('acreditar: cambiar el payload tras un error usa otra clave y el conflicto queda visible', async () => {
    mocks.grant
      .mockResolvedValueOnce({ ok: false, code: 'INTERNAL_ERROR' })
      .mockResolvedValueOnce({ ok: false, code: 'IDEMPOTENCY_CONFLICT' });
    renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Acreditar créditos' }));
    fireEvent.change(screen.getByLabelText('Cantidad de créditos'), { target: { value: '3' } });
    fireEvent.click(screen.getByLabelText(/Ajuste administrativo/));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    await screen.findByRole('alert');

    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
    fireEvent.change(screen.getByLabelText('Cantidad de créditos'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(getDomainErrorMessage('IDEMPOTENCY_CONFLICT'))
    );
    const [first, second] = mocks.grant.mock.calls.map((call) => call[0]);
    expect(first.source).toBe('adjustment');
    expect(second.credits).toBe(4);
    expect(second.operationKey).not.toBe(first.operationKey);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('registrar plan: solo ofrece planes activos y muestra el resultado del período', async () => {
    mocks.register.mockResolvedValue({
      ok: true,
      data: {
        periodId: 'f1000000-0000-4000-8000-000000000009',
        merchantId: MERCHANT.id,
        planId: PLAN_ACTIVE.id,
        startsAt: '2026-11-10T15:00:00.000Z',
        endsAt: '2026-12-10T15:00:00.000Z',
        streak: 3,
        carryoverPct: 10,
        launchDiscountPct: null,
        idempotent: false,
      },
    });
    renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar o renovar plan' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText(/Plan viejo/)).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }));
    expect(await within(dialog).findByText('Elegí un plan del catálogo.')).toBeTruthy();

    fireEvent.click(within(dialog).getByLabelText(/Plan 40/));
    fireEvent.click(within(dialog).getByLabelText('Cortesía (sin compra)'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Vas a registrar «Plan 40» para Kiosco Centro como cortesía (sin compra).')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText('Del 10/11/2026 12:00 al 10/12/2026 12:00 · racha 3 · arrastre 10 %')).toBeTruthy();
    expect(mocks.register).toHaveBeenCalledWith({
      merchantId: MERCHANT.id,
      planId: PLAN_ACTIVE.id,
      isPurchase: false,
      note: null,
      operationKey: expect.any(String),
    });
  });

  it('registrar plan: el rechazo de la RPC (plan inactivo) se ve en el diálogo y no refresca', async () => {
    mocks.register.mockResolvedValue({ ok: false, code: 'PLAN_INACTIVE' });
    renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar o renovar plan' }));
    fireEvent.click(screen.getByLabelText(/Plan 40/));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));
    expect((await screen.findByRole('alert')).textContent).toBe(getDomainErrorMessage('PLAN_INACTIVE'));
    expect(mocks.notifyError).toHaveBeenCalledWith(getDomainErrorMessage('PLAN_INACTIVE'));
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('sin planes activos no se puede continuar y la segunda página ofrece volver al inicio', () => {
    renderView({ plans: [PLAN_INACTIVE], currentBeforeId: 11, data: { ...DATA, nextCursor: null } });
    expect(within(screen.getByRole('navigation', { name: 'Paginación del libro' })).getByRole('link', { name: 'Volver a los más recientes' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar o renovar plan' }));
    expect(screen.getByText('No hay planes activos en el catálogo.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
