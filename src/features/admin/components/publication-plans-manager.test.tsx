// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { getDomainErrorMessage } from '@/lib/error-messages';
import { PublicationPlansManager } from './publication-plans-manager';
import type { PublicationPlanItem } from '../types';

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), upsert: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));
vi.mock('../actions', () => ({ upsertPublicationPlanAction: mocks.upsert }));
vi.mock('@/ui/notify', () => ({ notify: { success: mocks.success, error: mocks.error, info: vi.fn() } }));

const PLAN: PublicationPlanItem = {
  id: 'f0000000-0000-4000-8000-000000000001',
  code: 'plan-40',
  name: 'Plan 40',
  kind: 'quota',
  monthlyCredits: 40,
  referencePriceArs: 20000,
  active: true,
  sort: 1,
};
const UNLIMITED: PublicationPlanItem = { ...PLAN, id: 'f0000000-0000-4000-8000-000000000002', code: 'ilimitado', name: 'Ilimitado', kind: 'unlimited', monthlyCredits: null, referencePriceArs: null, active: false, sort: 2 };

describe('T-369 / CC-029 — catálogo de planes (admin)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('lista los planes con tipo, cupo, precio informativo y estado', () => {
    render(<PublicationPlansManager plans={[PLAN, UNLIMITED]} />);
    const rows = within(screen.getByRole('table', { name: 'Planes de publicación' })).getAllByRole('row').slice(1);
    expect(rows[0]?.textContent).toContain('Plan 40plan-40Con cupo40$ 20.000Activo1');
    expect(rows[1]?.textContent).toContain('IlimitadoilimitadoIlimitado——Inactivo2');
  });

  it('vacío: invita a crear el primero', () => {
    render(<PublicationPlansManager plans={[]} />);
    expect(screen.getByText('Todavía no hay planes. Creá el primero.')).toBeTruthy();
  });

  it('crear: un plan con cupo exige créditos y el ilimitado los manda en null', async () => {
    mocks.upsert.mockResolvedValue({ ok: true, data: { ...UNLIMITED, planId: UNLIMITED.id } });
    render(<PublicationPlansManager plans={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo plan' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nombre'), { target: { value: 'Ilimitado' } });
    fireEvent.change(within(dialog).getByLabelText('Código'), { target: { value: 'ilimitado' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(await within(dialog).findByText('Un plan con cupo lleva entre 1 y 100.000 créditos por mes.')).toBeTruthy();
    expect(mocks.upsert).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByLabelText('Ilimitado'));
    expect(within(dialog).queryByLabelText('Créditos por mes')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(mocks.upsert).toHaveBeenCalledWith({
        planId: null,
        code: 'ilimitado',
        name: 'Ilimitado',
        kind: 'unlimited',
        monthlyCredits: null,
        referencePriceArs: null,
        active: true,
        sort: 0,
      })
    );
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('editar: precarga el plan y muestra PLAN_IN_USE si se cambia el cupo de uno en uso', async () => {
    mocks.upsert.mockResolvedValue({ ok: false, code: 'PLAN_IN_USE' });
    render(<PublicationPlansManager plans={[PLAN]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar el plan Plan 40' }));
    const dialog = screen.getByRole('dialog');
    const credits = within(dialog).getByLabelText('Créditos por mes') as HTMLInputElement;
    expect(credits.value).toBe('40');
    fireEvent.change(credits, { target: { value: '50' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect((await within(dialog).findByRole('alert')).textContent).toBe(getDomainErrorMessage('PLAN_IN_USE'));
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ planId: PLAN.id, monthlyCredits: 50 }));
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
