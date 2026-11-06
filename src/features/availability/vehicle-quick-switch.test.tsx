// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  setActiveCourierVehicleAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('@/features/courier-onboarding', async () => {
  const copy = await import('@/features/courier-onboarding/copy');
  return {
    COURIER_VEHICLES_COPY: copy.COURIER_VEHICLES_COPY,
    setActiveCourierVehicleAction: mocks.setActiveCourierVehicleAction,
  };
});
vi.mock('@/ui/notify', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { VehicleQuickSwitch } from './components/vehicle-quick-switch';

const MOTO = { id: '11111111-1111-4111-8111-111111111111', vehicleType: 'moto', plate: 'AB 123 CD' } as const;
const BIKE = { id: '22222222-2222-4222-8222-222222222222', vehicleType: 'bike', plate: null } as const;

describe('T-419 (CC-042): cambio rápido del vehículo activo', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('con un solo vehículo no se muestra', () => {
    const { container } = render(<VehicleQuickSwitch activeVehicleId={MOTO.id} vehicles={[MOTO]} />);
    expect(container.innerHTML).toBe('');
  });

  it('marca el activo y al elegir otro lo activa y refresca', async () => {
    mocks.setActiveCourierVehicleAction.mockResolvedValue({ ok: true, data: { activeVehicleId: BIKE.id } });
    render(<VehicleQuickSwitch activeVehicleId={MOTO.id} vehicles={[MOTO, BIKE]} />);
    expect(screen.getByRole('radio', { name: 'Moto · AB 123 CD' }).getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByRole('radio', { name: 'Bici' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Bici' }).getAttribute('aria-checked')).toBe('true'));
    expect(mocks.setActiveCourierVehicleAction).toHaveBeenCalledWith({ vehicleId: BIKE.id });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('elegir el activo no llama a la acción', () => {
    render(<VehicleQuickSwitch activeVehicleId={MOTO.id} vehicles={[MOTO, BIKE]} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Moto · AB 123 CD' }));
    expect(mocks.setActiveCourierVehicleAction).not.toHaveBeenCalled();
  });

  it('bloqueado por ofertas o viaje: explica el motivo en pantalla y el activo no cambia', async () => {
    mocks.setActiveCourierVehicleAction.mockResolvedValue({ ok: false, code: 'VEHICLE_SWITCH_BLOCKED' });
    render(<VehicleQuickSwitch activeVehicleId={MOTO.id} vehicles={[MOTO, BIKE]} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Bici' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Retirá tus ofertas pendientes o terminá el viaje para cambiar de vehículo.');
    expect(screen.getByRole('radio', { name: 'Moto · AB 123 CD' }).getAttribute('aria-checked')).toBe('true');
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
