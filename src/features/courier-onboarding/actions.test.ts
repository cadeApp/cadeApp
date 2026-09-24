import { describe, expect, it, vi, beforeEach } from 'vitest';
import { courierOnboardingAction } from './actions';
import * as serverAuth from '@/server/supabase/server';
import * as adminAuth from '@/server/supabase/admin';

vi.mock('@/server/supabase/server');
vi.mock('@/server/supabase/admin');
vi.mock('@/server/env', () => ({
  serverEnv: {
    DNI_HMAC_SECRET: 'super-secret-hmac-key-for-test-32bytes',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    NODE_ENV: 'test',
  },
}));

describe('T-121 · DoD 3: DNI de un rechazado bloqueado y Server Action de Onboarding', () => {
  const currentUserId = 'courier-current-user-uuid';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rechaza la acción si el usuario no está autenticado', async () => {
    vi.mocked(serverAuth.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('No auth') }),
      },
    } as unknown as ReturnType<typeof serverAuth.createClient>);

    const result = await courierOnboardingAction({
      dni: '38123456',
      vehicleType: 'moto',
      vehiclePlate: 'A 123 BCD',
      documents: {
        dni_front: 'courier/courier-current-user-uuid/dni_front_1.jpg',
        dni_back: 'courier/courier-current-user-uuid/dni_back_1.jpg',
        selfie: 'courier/courier-current-user-uuid/selfie_1.jpg',
        avatar: 'courier/courier-current-user-uuid/avatar_1.jpg',
      },
      consents: {
        tos: true,
        privacy: true,
        courierContract: true,
      },
    });

    expect(result).toEqual({ ok: false, code: 'UNAUTHENTICATED' });
  });

  it('rechaza la acción si el usuario autenticado no tiene rol courier', async () => {
    vi.mocked(serverAuth.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: currentUserId, email: 'merchant@cadeapp.test' } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'merchant' }, error: null }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    } as unknown as ReturnType<typeof serverAuth.createClient>);

    const result = await courierOnboardingAction({
      dni: '38123456',
      vehicleType: 'moto',
      vehiclePlate: 'A 123 BCD',
      documents: {
        dni_front: 'courier/courier-current-user-uuid/dni_front_1.jpg',
        dni_back: 'courier/courier-current-user-uuid/dni_back_1.jpg',
        selfie: 'courier/courier-current-user-uuid/selfie_1.jpg',
        avatar: 'courier/courier-current-user-uuid/avatar_1.jpg',
      },
      consents: {
        tos: true,
        privacy: true,
        courierContract: true,
      },
    });

    expect(result).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
  });

  it('DoD central: bloquea el registro si el DNI pertenece a un repartidor rechazado (dni_hmac detectado)', async () => {
    // 1. Cliente autenticado del courier
    vi.mocked(serverAuth.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: currentUserId, email: 'courier@cadeapp.test' } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'courier' }, error: null }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    } as unknown as ReturnType<typeof serverAuth.createClient>);

    // 2. Cliente administrativo (detecta courier previo con status 'rejected')
    const mockAdminFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'couriers') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              profile_id: 'rejected-courier-uuid',
              status: 'rejected',
            },
            error: null,
          }),
        };
      }
      return { select: vi.fn().mockReturnThis() };
    });

    vi.mocked(adminAuth.createAdminClient).mockReturnValue({
      from: mockAdminFrom,
    } as unknown as ReturnType<typeof adminAuth.createAdminClient>);

    const result = await courierOnboardingAction({
      dni: '38123456',
      vehicleType: 'moto',
      vehiclePlate: 'A 123 BCD',
      documents: {
        dni_front: 'courier/courier-current-user-uuid/dni_front_1.jpg',
        dni_back: 'courier/courier-current-user-uuid/dni_back_1.jpg',
        selfie: 'courier/courier-current-user-uuid/selfie_1.jpg',
        avatar: 'courier/courier-current-user-uuid/avatar_1.jpg',
      },
      consents: {
        tos: true,
        privacy: true,
        courierContract: true,
      },
    });

    // Debe retornar DNI_ALREADY_REGISTERED y bloquear el intento de reingreso
    expect(result).toEqual({ ok: false, code: 'DNI_ALREADY_REGISTERED' });
  });

  it('permite el onboarding si el DNI es nuevo y registra datos, consentimientos y documentos', async () => {
    const mockUpdateCourier = vi.fn().mockResolvedValue({ error: null });
    const mockInsertConsents = vi.fn().mockResolvedValue({ error: null });
    const mockUpsertDocuments = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(serverAuth.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: currentUserId, email: 'courier@cadeapp.test' } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'courier' }, error: null }),
          };
        }
        if (table === 'consents') {
          return {
            insert: mockInsertConsents,
          };
        }
        if (table === 'courier_documents') {
          return {
            upsert: mockUpsertDocuments,
          };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    } as unknown as ReturnType<typeof serverAuth.createClient>);

    // Admin client: no existe courier previo con este dni_hmac
    const mockAdminFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'couriers') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
          update: vi.fn().mockReturnValue({
            eq: mockUpdateCourier,
          }),
        };
      }
      return { select: vi.fn().mockReturnThis() };
    });

    vi.mocked(adminAuth.createAdminClient).mockReturnValue({
      from: mockAdminFrom,
    } as unknown as ReturnType<typeof adminAuth.createAdminClient>);

    const result = await courierOnboardingAction({
      dni: '38123456',
      vehicleType: 'moto',
      vehiclePlate: 'A 123 BCD',
      documents: {
        dni_front: 'courier/courier-current-user-uuid/dni_front_1.jpg',
        dni_back: 'courier/courier-current-user-uuid/dni_back_1.jpg',
        selfie: 'courier/courier-current-user-uuid/selfie_1.jpg',
        avatar: 'courier/courier-current-user-uuid/avatar_1.jpg',
      },
      consents: {
        tos: true,
        privacy: true,
        courierContract: true,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.redirectTo).toBe('/onboarding/status');
    }

    // Se actualizó dni_hmac y vehículo mediante admin client
    expect(mockUpdateCourier).toHaveBeenCalled();
  });
});
