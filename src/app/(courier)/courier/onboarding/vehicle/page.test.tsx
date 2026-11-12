// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import CanonicalCourierOnboardingVehiclePage from './page';
import * as serverSupabase from '@/server/supabase/server';

const mocks = vi.hoisted(() => ({
  VehicleForm: vi.fn((_props: Record<string, unknown>) => <div data-testid="vehicle-form" />),
  CourierVehiclesManager: vi.fn((_props: Record<string, unknown>) => <div data-testid="vehicles-manager" />),
  getMyCourierVehicles: vi.fn(),
}));

vi.mock('@/server/supabase/server');
vi.mock('@/features/courier-onboarding', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    VehicleForm: mocks.VehicleForm,
    CourierVehiclesManager: mocks.CourierVehiclesManager,
  };
});
vi.mock('@/features/courier-onboarding/server', () => ({ getMyCourierVehicles: mocks.getMyCourierVehicles }));

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

  it('CC-042: con la postulación enviada muestra «Mis vehículos» con los vehículos de la RPC, no el formulario de alta', async () => {
    const vehicles = {
      activeVehicleId: 'vehicle-moto',
      vehicles: [{ id: 'vehicle-moto', vehicleType: 'moto', plate: 'AB 123 CD', licenseStatus: 'none', insuranceStatus: 'none' }],
    };
    mocks.getMyCourierVehicles.mockResolvedValue(vehicles);
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
                application_submitted: true,
              },
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

    render(await CanonicalCourierOnboardingVehiclePage({}));

    expect(mocks.VehicleForm).not.toHaveBeenCalled();
    expect(mocks.CourierVehiclesManager).toHaveBeenCalledTimes(1);
    expect(mocks.CourierVehiclesManager.mock.calls[0]?.[0]).toMatchObject({ courierId: courierUserId, vehicles });
  });

  it('si el repartidor no envió la postulación (onboarding incompleto), muestra el formulario de alta', async () => {
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
                application_submitted: false,
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
    expect(passedProps).toMatchObject({ courierId: courierUserId });
    expect(mocks.CourierVehiclesManager).not.toHaveBeenCalled();
  });
  it('mode=edit no convierte un alta incompleta en edición', async () => {
    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: courierUserId } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { vehicle_type: null, vehicle_plate: null, status: 'pending', application_submitted: false }, error: null,
        }),
      }),
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);
    render(await CanonicalCourierOnboardingVehiclePage({ searchParams: Promise.resolve({ mode: 'edit' }) }));
    expect(mocks.VehicleForm).toHaveBeenCalledTimes(1);
    expect(mocks.CourierVehiclesManager).not.toHaveBeenCalled();
    expect(mocks.getMyCourierVehicles).not.toHaveBeenCalled();
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

  describe('CC-050 (SEC-09): enlace al WhatsApp de soporte armado en el servidor', () => {
    function mockIncompleteCourier() {
      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: courierUserId } } }) },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { vehicle_type: null, vehicle_plate: null, status: 'pending', application_submitted: false },
            error: null,
          }),
        }),
      } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);
    }

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('con un número válido pasa un wa.me con un mensaje neutral, sin DNI', async () => {
      vi.stubEnv('CADEAPP_SUPPORT_WHATSAPP_NUMBER', '+54 9 381 555 0000');
      mockIncompleteCourier();

      render(await CanonicalCourierOnboardingVehiclePage({}));

      const href = mocks.VehicleForm.mock.calls[0]?.[0]?.supportWhatsAppHref;
      expect(typeof href).toBe('string');
      expect(String(href)).toMatch(/^https:\/\/wa\.me\/5493815550000\?text=/);
      const message = decodeURIComponent(new URL(String(href)).searchParams.get('text') ?? '');
      expect(message).toBe('Hola, no pude completar mi alta como repartidor y necesito ayuda.');
      expect(message).not.toMatch(/\d{7,8}|dni/i);
    });

    it.each([['inválido', '123'], ['ausente', undefined]])('con un número %s pasa null', async (_label, value) => {
      if (value === undefined) {
        vi.stubEnv('CADEAPP_SUPPORT_WHATSAPP_NUMBER', '');
      } else {
        vi.stubEnv('CADEAPP_SUPPORT_WHATSAPP_NUMBER', value);
      }
      mockIncompleteCourier();

      render(await CanonicalCourierOnboardingVehiclePage({}));

      expect(mocks.VehicleForm.mock.calls[0]?.[0]).toMatchObject({ supportWhatsAppHref: null });
    });
  });

});
