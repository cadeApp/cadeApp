// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import CanonicalCourierOnboardingVehiclePage from './page';
import * as serverSupabase from '@/server/supabase/server';

const mocks = vi.hoisted(() => ({
  VehicleForm: vi.fn((_props: Record<string, unknown>) => <div data-testid="vehicle-form" />),
}));

vi.mock('@/server/supabase/server');
vi.mock('@/features/courier-onboarding', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    VehicleForm: mocks.VehicleForm,
  };
});

describe('T-357: CanonicalCourierOnboardingVehiclePage', () => {
  const courierUserId = 'test-courier-user-357';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirige a /login?redirectTo=/courier/onboarding/vehicle si user es null', async () => {
    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

    try {
      await CanonicalCourierOnboardingVehiclePage({});
      expect.unreachable('Debe lanzar redirect');
    } catch (err: unknown) {
      expect((err as Error).message).toBe('NEXT_REDIRECT');
      expect((err as { digest?: string }).digest).toContain(
        '/login?redirectTo=/courier/onboarding/vehicle'
      );
    }
  });

  it('detecta vehículo existente en base de datos y pasa isEditing={true} y valores iniciales a VehicleForm', async () => {
    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: courierUserId } },
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'couriers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                vehicle_type: 'moto',
                vehicle_plate: 'AB 123 CD',
                status: 'approved',
              },
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

    render(await CanonicalCourierOnboardingVehiclePage({}));

    expect(mocks.VehicleForm).toHaveBeenCalledTimes(1);
    const passedProps = mocks.VehicleForm.mock.calls[0]?.[0];
    expect(passedProps).toMatchObject({
      courierId: courierUserId,
      isEditing: true,
      initialVehicleType: 'moto',
      initialVehiclePlate: 'AB 123 CD',
    });
  });

  it('si el repartidor no tiene vehículo declarado (onboarding incompleto), pasa isEditing={false}', async () => {
    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: courierUserId } },
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'couriers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                vehicle_type: null,
                vehicle_plate: null,
                status: 'pending',
              },
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

    render(await CanonicalCourierOnboardingVehiclePage({}));

    expect(mocks.VehicleForm).toHaveBeenCalledTimes(1);
    const passedProps = mocks.VehicleForm.mock.calls[0]?.[0];
    expect(passedProps).toMatchObject({
      courierId: courierUserId,
      isEditing: false,
    });
  });
  it('mode=edit no convierte un alta incompleta en edición', async () => {
    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: courierUserId } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { vehicle_type: null, vehicle_plate: null, status: 'pending' }, error: null,
        }),
      }),
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);
    render(await CanonicalCourierOnboardingVehiclePage({ searchParams: Promise.resolve({ mode: 'edit' }) }));
    expect(mocks.VehicleForm.mock.calls[0]?.[0]).toMatchObject({ isEditing: false });
  });

  it('error al consultar no debe dibujar un onboarding falso', async () => {
    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: courierUserId } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'SQL error' } }),
      }),
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);
    await expect(CanonicalCourierOnboardingVehiclePage({})).rejects.toThrow('No se pudo consultar');
    expect(mocks.VehicleForm).not.toHaveBeenCalled();
  });

});
