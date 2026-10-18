// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ok, err, publicationBalanceSchema, type PublicationBalance } from '@/domain';
import { PublicationBalanceSection } from './publication-balance-section';

const MERCHANT = '20000000-0000-4000-8000-000000000369';
const lotId = (n: number) => `50000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const periodId = (n: number) => `51000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PLAN = '52000000-0000-4000-8000-000000000001';

function balance(overrides: Partial<PublicationBalance> = {}): PublicationBalance {
  // Se valida contra el contrato real para no probar formas que la RPC no puede devolver.
  return publicationBalanceSchema.parse({
    merchantId: MERCHANT,
    mode: 'credits',
    canPublish: true,
    subscriptionStatus: 'expired',
    legacyPaidUntil: null,
    available: 0,
    reserved: 0,
    scheduled: 0,
    currentPeriod: null,
    nextPeriod: null,
    lots: [],
    ...overrides,
  });
}

function renderSection(result: Parameters<typeof PublicationBalanceSection>[0]['result']) {
  render(<PublicationBalanceSection result={result} />);
}

describe('T-369 / CC-029 — Mi plan con el saldo real', () => {
  afterEach(cleanup);

  it('piloto activo: publicar es gratis e ilimitado y los créditos quedan guardados', () => {
    renderSection(ok(balance({ mode: 'pilot', subscriptionStatus: 'pilot', available: 4 })));
    expect(screen.getByText('Piloto')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Estás en el piloto gratis' })).toBeTruthy();
    expect(screen.getByText(/Publicar es gratis e ilimitado mientras dure el piloto/)).toBeTruthy();
    expect(screen.getByText(/tus créditos no se usan/)).toBeTruthy();
  });

  it('créditos: muestra disponibles, reservados y cada lote con su vencimiento real', () => {
    renderSection(
      ok(
        balance({
          available: 7,
          reserved: 2,
          scheduled: 40,
          currentPeriod: {
            periodId: periodId(1),
            planId: PLAN,
            planName: 'Plan 40',
            planKind: 'quota',
            monthlyCredits: 40,
            startsAt: '2026-10-10T15:00:00.000Z',
            endsAt: '2026-11-10T15:00:00.000Z',
            streak: 2,
            carryoverPct: 5,
          },
          nextPeriod: {
            periodId: periodId(2),
            planId: PLAN,
            planName: 'Plan 40',
            planKind: 'quota',
            monthlyCredits: 40,
            startsAt: '2026-11-10T15:00:00.000Z',
            endsAt: '2026-12-10T15:00:00.000Z',
            streak: 3,
            carryoverPct: 10,
          },
          lots: [
            { lotId: lotId(1), kind: 'plan', source: 'plan', granted: 40, available: 3, startsAt: '2026-10-10T15:00:00.000Z', expiresAt: '2026-11-10T15:00:00.000Z', usable: true },
            { lotId: lotId(2), kind: 'carryover', source: 'carryover', granted: 2, available: 2, startsAt: '2026-10-10T15:00:00.000Z', expiresAt: '2026-11-10T15:00:00.000Z', usable: true },
            { lotId: lotId(3), kind: 'loose', source: 'purchase', granted: 5, available: 1, startsAt: null, expiresAt: null, usable: true },
            { lotId: lotId(4), kind: 'loose', source: 'refund_conversion', granted: 1, available: 1, startsAt: null, expiresAt: null, usable: true },
            { lotId: lotId(5), kind: 'plan', source: 'plan', granted: 40, available: 40, startsAt: '2026-11-10T15:00:00.000Z', expiresAt: '2026-12-10T15:00:00.000Z', usable: false },
          ],
        })
      )
    );
    const stats = screen.getByText('Créditos disponibles').closest('dl');
    if (!stats) throw new Error('sin resumen');
    expect(within(stats).getByText('7')).toBeTruthy();
    expect(within(stats).getByText('2')).toBeTruthy();
    expect(within(stats).getByText('40')).toBeTruthy();

    expect(screen.getByText('Plan vigente: Plan 40')).toBeTruthy();
    expect(screen.getByText(/Del 10\/10\/2026 12:00 al 10\/11\/2026 12:00/)).toBeTruthy();
    expect(screen.getByText(/2 meses seguidos · arrastrás el 5 %/)).toBeTruthy();
    expect(screen.getByText('Próximo período: Plan 40')).toBeTruthy();
    expect(screen.getByText(/Empieza el 10\/11\/2026 12:00/)).toBeTruthy();

    const rows = within(screen.getByRole('table', { name: 'Créditos por lote' })).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      'Del plan3 de 40Vencen el 10/11/2026 12:00',
      'Arrastrados2 de 2Vencen el 10/11/2026 12:00',
      'Sueltos1 de 5No vencen',
      'Devueltos1 de 1No vencen',
      'Del plan40 de 40Se habilitan el 10/11/2026 12:00',
    ]);
  });

  it('abono legacy e ilimitado: no piden créditos y muestran hasta cuándo rige', () => {
    renderSection(ok(balance({ mode: 'legacy_paid', subscriptionStatus: 'active', legacyPaidUntil: '2026-11-30' })));
    expect(screen.getByRole('heading', { name: 'Tu abono está vigente' })).toBeTruthy();
    expect(screen.getByText('Abono registrado hasta el 30 de noviembre de 2026.')).toBeTruthy();
    cleanup();

    renderSection(
      ok(
        balance({
          mode: 'unlimited',
          currentPeriod: {
            periodId: periodId(3),
            planId: PLAN,
            planName: 'Ilimitado',
            planKind: 'unlimited',
            monthlyCredits: null,
            startsAt: '2026-10-01T03:00:00.000Z',
            endsAt: '2026-11-01T03:00:00.000Z',
            streak: 1,
            carryoverPct: 0,
          },
        })
      )
    );
    expect(screen.getByRole('heading', { name: 'Tenés un plan ilimitado' })).toBeTruthy();
    expect(screen.getByText(/Publicaciones ilimitadas/)).toBeTruthy();
    expect(screen.queryByText(/meses seguidos/)).toBeNull();
  });

  it('sin créditos ni plan: lo dice sin inventar saldo y explica cómo seguir', () => {
    renderSection(ok(balance({ canPublish: false })));
    expect(screen.getByRole('heading', { name: 'No tenés créditos disponibles' })).toBeTruthy();
    expect(screen.getByText(/cadeApp no cobra dentro de la app/)).toBeTruthy();
    expect(screen.getByText('Todavía no tenés créditos ni plan')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('cuenta pausada o no habilitada: distingue el motivo del bloqueo', () => {
    renderSection(ok(balance({ canPublish: false, subscriptionStatus: 'cancelled', available: 3 })));
    expect(screen.getByRole('heading', { name: 'Tu cuenta de comercio está pausada' })).toBeTruthy();
    cleanup();
    renderSection(ok(balance({ canPublish: false, available: 3 })));
    expect(screen.getByRole('heading', { name: 'No podés publicar en este momento' })).toBeTruthy();
  });

  it('error de la RPC: aviso accesible con reintento y sin datos inventados', () => {
    renderSection(err('INTERNAL_ERROR'));
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('No pudimos cargar tu saldo de créditos')).toBeTruthy();
    expect(within(alert).getByRole('link', { name: 'Reintentar' }).getAttribute('href')).toBe('/merchant/plan');
    expect(screen.queryByText('Créditos disponibles')).toBeNull();
    expect(screen.queryByText('Piloto')).toBeNull();
  });
});
