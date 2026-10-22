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
  listPlans: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));
vi.mock('../actions', () => ({
  grantPublicationCreditsAction: mocks.grant,
  registerPlanPeriodAction: mocks.register,
  listPublicationPlansAction: mocks.listPlans,
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
    <MerchantCreditsView
      merchant={MERCHANT}
      data={DATA}
      plans={[PLAN_ACTIVE, PLAN_INACTIVE]}
      plansNextCursor={null}
      currentBeforeId={null}
      {...overrides}
    />
  );
}

const grantOk = (idempotent: boolean, launchDiscountPct: number | null) => ({
  ok: true as const,
  data: { lotId: PLAN_ACTIVE.id, merchantId: MERCHANT.id, credits: 10, source: 'purchase' as const, launchDiscountPct, idempotent },
});

const OTHER_MERCHANT = { id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', businessName: 'Almacén Sur' };
const PLAN_OTHER: PublicationPlanItem = { ...PLAN_ACTIVE, id: 'f0000000-0000-4000-8000-000000000003', code: 'plan-80', name: 'Plan 80', monthlyCredits: 80, sort: 2 };

const registerOk = (idempotent: boolean) => ({
  ok: true as const,
  data: {
    periodId: 'f1000000-0000-4000-8000-000000000009',
    merchantId: MERCHANT.id,
    planId: PLAN_ACTIVE.id,
    startsAt: '2026-11-10T15:00:00.000Z',
    endsAt: '2026-12-10T15:00:00.000Z',
    streak: 1,
    carryoverPct: 0,
    launchDiscountPct: null,
    idempotent,
  },
});

/** Abre «Acreditar créditos», completa el formulario y confirma; vuelve cuando termina el intento. */
async function grantOnce(values: { credits: string; adjustment?: boolean; note?: string }) {
  fireEvent.click(screen.getByRole('button', { name: 'Acreditar créditos' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Cantidad de créditos'), { target: { value: values.credits } });
  if (values.adjustment) fireEvent.click(within(dialog).getByLabelText(/Ajuste administrativo/));
  if (values.note) fireEvent.change(within(dialog).getByLabelText('Nota (opcional)'), { target: { value: values.note } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }));
  const calls = mocks.grant.mock.calls.length;
  fireEvent.click(await within(dialog).findByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(mocks.grant.mock.calls.length).toBe(calls + 1));
  await waitFor(() => expect(within(dialog).queryByRole('button', { name: 'Guardando...' })).toBeNull());
}

async function registerOnce(values: { planName: RegExp; courtesy?: boolean; note?: string }) {
  fireEvent.click(screen.getByRole('button', { name: 'Registrar o renovar plan' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByLabelText(values.planName));
  if (values.courtesy) fireEvent.click(within(dialog).getByLabelText('Cortesía (sin compra)'));
  if (values.note) fireEvent.change(within(dialog).getByLabelText('Nota (opcional)'), { target: { value: values.note } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }));
  const calls = mocks.register.mock.calls.length;
  fireEvent.click(await within(dialog).findByRole('button', { name: 'Confirmar' }));
  await waitFor(() => expect(mocks.register.mock.calls.length).toBe(calls + 1));
  await waitFor(() => expect(within(dialog).queryByRole('button', { name: 'Guardando...' })).toBeNull());
}

async function closeDialog() {
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}

function lastKey(mock: typeof mocks.grant): string {
  const call = mock.mock.calls[mock.mock.calls.length - 1];
  return String(call?.[0].operationKey);
}

function planPage(from: number, count: number): PublicationPlanItem[] {
  return Array.from({ length: count }, (_, index) => {
    const n = from + index;
    return {
      ...PLAN_ACTIVE,
      id: `f0000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
      code: `plan-${n}`,
      name: `Plan N${n}`,
      sort: Math.floor(n / 3),
    };
  });
}
function cursorOf(page: readonly PublicationPlanItem[]) {
  const last = page[page.length - 1];
  return last ? { sort: last.sort, id: last.id } : null;
}

describe('T-369 / CC-029 — créditos de un comercio (admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

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

  it('PR402-H01 acreditar: tras perder la respuesta y recargar, el mismo payload reusa la clave; después del éxito, una compra idéntica usa otra', async () => {
    mocks.grant
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(grantOk(true, null))
      .mockResolvedValueOnce(grantOk(false, null));
    renderView();
    await grantOnce({ credits: '10', note: 'Factura 12 de Juan' });
    const lost = lastKey(mocks.grant);
    expect(within(screen.getByRole('dialog')).getByRole('alert').textContent).toBe(
      'No pudimos confirmar si se registró. Volvé a confirmar: se reintenta la misma operación y no se duplica.'
    );
    const stored = JSON.stringify(Object.entries(window.sessionStorage));
    expect(stored).toContain(lost);
    expect(stored).not.toContain('Factura');
    expect(stored).not.toContain(MERCHANT.id);

    // Recarga en la misma pestaña: se desmonta todo y sessionStorage sobrevive.
    cleanup();
    renderView();
    await grantOnce({ credits: '10', note: 'Factura 12 de Juan' });
    expect(lastKey(mocks.grant)).toBe(lost);
    expect(await screen.findByText('Esa operación ya estaba registrada: no se acreditó dos veces.', { selector: 'p' })).toBeTruthy();

    await closeDialog();
    await grantOnce({ credits: '10', note: 'Factura 12 de Juan' });
    expect(lastKey(mocks.grant)).not.toBe(lost);
    expect(mocks.grant.mock.calls.map((call) => call[0].credits)).toEqual([10, 10, 10]);
  });

  it('PR402-H01 acreditar: con un intento pendiente, otro comercio, cantidad, origen o nota no reusan su clave', async () => {
    mocks.grant.mockRejectedValue(new Error('timeout'));
    renderView();
    await grantOnce({ credits: '10' });
    const pending = lastKey(mocks.grant);
    const keys = new Set<string>([pending]);

    for (const variant of [{ credits: '11' }, { credits: '10', adjustment: true }, { credits: '10', note: 'otra' }]) {
      await closeDialog();
      await grantOnce(variant);
      keys.add(lastKey(mocks.grant));
    }
    cleanup();
    renderView({ merchant: OTHER_MERCHANT });
    await grantOnce({ credits: '10' });
    keys.add(lastKey(mocks.grant));
    expect(keys.size).toBe(5);

    cleanup();
    renderView();
    await grantOnce({ credits: '10' });
    expect(lastKey(mocks.grant)).toBe(pending);
  });

  it('PR402-H01 acreditar: sin sessionStorage no envía con una clave nueva y explica cómo seguir', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Acreditar créditos' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Cantidad de créditos'), { target: { value: '10' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Confirmar' }));
    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      'Este navegador no deja guardar la operación en curso, así que no la enviamos para no arriesgar un duplicado. Abrí el panel en una ventana común del navegador y revisá el libro antes de reintentar.'
    );
    expect(mocks.grant).not.toHaveBeenCalled();
  });

  it('PR402-H01 registrar plan: misma recuperación tras recargar y clave nueva tras el éxito o con otro payload', async () => {
    mocks.register
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(registerOk(true))
      .mockResolvedValueOnce(registerOk(false))
      .mockRejectedValue(new Error('network'));
    const plans = [PLAN_ACTIVE, PLAN_OTHER];
    renderView({ plans });
    await registerOnce({ planName: /Plan 40/, note: 'Pago en efectivo' });
    const lost = lastKey(mocks.register);
    expect(JSON.stringify(Object.entries(window.sessionStorage))).not.toContain('efectivo');

    cleanup();
    renderView({ plans });
    await registerOnce({ planName: /Plan 40/, note: 'Pago en efectivo' });
    expect(lastKey(mocks.register)).toBe(lost);
    expect(await screen.findByText('Ese período ya estaba registrado: no se creó otro.', { selector: 'p' })).toBeTruthy();

    await closeDialog();
    await registerOnce({ planName: /Plan 40/, note: 'Pago en efectivo' });
    const fresh = lastKey(mocks.register);
    expect(fresh).not.toBe(lost);

    // Otro intento con la respuesta perdida queda pendiente; ninguna variante reusa su clave.
    await closeDialog();
    await registerOnce({ planName: /Plan 40/ });
    const pending = lastKey(mocks.register);
    const keys = new Set<string>([lost, fresh, pending]);
    for (const variant of [{ planName: /Plan 80/ }, { planName: /Plan 40/, courtesy: true }, { planName: /Plan 40/, note: 'otra' }]) {
      await closeDialog();
      await registerOnce(variant);
      keys.add(lastKey(mocks.register));
    }
    cleanup();
    renderView({ plans, merchant: OTHER_MERCHANT });
    await registerOnce({ planName: /Plan 40/ });
    keys.add(lastKey(mocks.register));
    expect(keys.size).toBe(7);

    cleanup();
    renderView({ plans });
    await registerOnce({ planName: /Plan 40/ });
    expect(lastKey(mocks.register)).toBe(pending);
  });

  it('PR402-H03 registrar plan: «Ver más planes» pagina por cursor hasta un plan activo de la página 4', async () => {
    const page1 = planPage(1, 50);
    const page2 = planPage(51, 50);
    const page3 = planPage(101, 50);
    const page4 = planPage(151, 1);
    mocks.listPlans
      .mockResolvedValueOnce({ ok: true, data: { items: page2, nextCursor: cursorOf(page2) } })
      .mockResolvedValueOnce({ ok: true, data: { items: page3, nextCursor: cursorOf(page3) } })
      .mockResolvedValueOnce({ ok: true, data: { items: page4, nextCursor: null } });
    mocks.register.mockResolvedValue(registerOk(false));
    renderView({ plans: page1, plansNextCursor: cursorOf(page1) });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar o renovar plan' }));
    const dialog = screen.getByRole('dialog');
    const planRadios = () => within(within(dialog).getByRole('group', { name: 'Plan' })).getAllByRole('radio');
    expect(planRadios()).toHaveLength(50);

    for (const expected of [100, 150, 151]) {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Ver más planes' }));
      await waitFor(() => expect(planRadios()).toHaveLength(expected));
    }
    expect(mocks.listPlans.mock.calls.map((call) => call[0])).toEqual([
      { activeOnly: true, afterSort: cursorOf(page1)?.sort, afterId: cursorOf(page1)?.id },
      { activeOnly: true, afterSort: cursorOf(page2)?.sort, afterId: cursorOf(page2)?.id },
      { activeOnly: true, afterSort: cursorOf(page3)?.sort, afterId: cursorOf(page3)?.id },
    ]);
    expect(within(dialog).queryByRole('button', { name: 'Ver más planes' })).toBeNull();
    const values = planRadios().map((radio) => (radio as HTMLInputElement).value);
    expect(new Set(values).size).toBe(151);

    fireEvent.click(within(dialog).getByLabelText(/Plan N151 /));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continuar' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mocks.register).toHaveBeenCalledTimes(1));
    expect(mocks.register.mock.calls[0]?.[0].planId).toBe(page4[0]?.id);
  });

  it('PR402-H03 registrar plan: si falla «Ver más planes» el error queda visible y se puede reintentar', async () => {
    const page1 = planPage(1, 50);
    const page2 = planPage(51, 1);
    mocks.listPlans
      .mockResolvedValueOnce({ ok: false, code: 'AAL2_REQUIRED' })
      .mockResolvedValueOnce({ ok: true, data: { items: page2, nextCursor: null } });
    renderView({ plans: page1, plansNextCursor: cursorOf(page1) });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar o renovar plan' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ver más planes' }));
    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      `No pudimos cargar más planes. ${getDomainErrorMessage('AAL2_REQUIRED')}`
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ver más planes' }));
    expect(await within(dialog).findByLabelText(/Plan N51 /)).toBeTruthy();
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });
});
