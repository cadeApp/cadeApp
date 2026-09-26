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
  const expectedHmac = '593c04e9d598a3bef0bbefa513180b4225b33b31f4682d9d44d81805e15c01e2';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rechaza la acción si el usuario no está autenticado', async () => {
    vi.mocked(serverAuth.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('No auth') }),
      },
    } as unknown as Awaited<ReturnType<typeof serverAuth.createClient>>);

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
        tosVersion: '1.0',
        privacyVersion: '1.0',
        courierContractVersion: '1.0',
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
    } as unknown as Awaited<ReturnType<typeof serverAuth.createClient>>);

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
        tosVersion: '1.0',
        privacyVersion: '1.0',
        courierContractVersion: '1.0',
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
    } as unknown as Awaited<ReturnType<typeof serverAuth.createClient>>);

    // 2. Cliente administrativo (detecta courier previo con status 'rejected')
    const mockAdminEq = vi.fn().mockReturnThis();
    const mockAdminFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'couriers') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: mockAdminEq,
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
        tosVersion: '1.0',
        privacyVersion: '1.0',
        courierContractVersion: '1.0',
      },
    });

    // Debe retornar DNI_ALREADY_REGISTERED y bloquear el intento de reingreso
    expect(result).toEqual({ ok: false, code: 'DNI_ALREADY_REGISTERED' });

    // PR77-H06: Verificación de que el mock se llame con la columna 'dni_hmac' y su hash HMAC-SHA256
    expect(mockAdminEq).toHaveBeenCalledWith('dni_hmac', expectedHmac);
  });

  it('bloquea el registro si el DNI pertenece a un repartidor suspendido (status suspended)', async () => {
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
    } as unknown as Awaited<ReturnType<typeof serverAuth.createClient>>);

    // 2. Cliente administrativo (detecta courier previo con status 'suspended')
    const mockAdminEq = vi.fn().mockReturnThis();
    const mockAdminFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'couriers') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: mockAdminEq,
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              profile_id: currentUserId,
              status: 'suspended',
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
        tosVersion: '1.0',
        privacyVersion: '1.0',
        courierContractVersion: '1.0',
      },
    });

    expect(result).toEqual({ ok: false, code: 'DNI_ALREADY_REGISTERED' });

    // PR77-H06: Verificación de que el mock se llame con la columna 'dni_hmac'
    expect(mockAdminEq).toHaveBeenCalledWith('dni_hmac', expectedHmac);
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
    } as unknown as Awaited<ReturnType<typeof serverAuth.createClient>>);

    // Admin client: no existe courier previo con este dni_hmac
    const mockAdminEq = vi.fn().mockReturnThis();
    const mockAdminUpdate = vi.fn().mockReturnValue({
      eq: mockUpdateCourier,
    });
    const mockAdminFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'couriers') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: mockAdminEq,
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
          update: mockAdminUpdate,
        };
      }
      if (table === 'consents') {
        return {
          insert: mockInsertConsents,
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
        tosVersion: '1.0',
        privacyVersion: '1.0',
        courierContractVersion: '1.0',
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.redirectTo).toBe('/onboarding/status');
    }

    // Consulta de DNI con dni_hmac
    expect(mockAdminEq).toHaveBeenCalledWith('dni_hmac', expectedHmac);

    // Se actualizó dni_hmac y vehículo mediante admin client
    expect(mockAdminUpdate).toHaveBeenCalledWith({
      dni_hmac: expectedHmac,
      vehicle_type: 'moto',
      vehicle_plate: 'A 123 BCD',
    });
    expect(mockUpdateCourier).toHaveBeenCalledWith('profile_id', currentUserId);

    // PR77-H03: Afirmaciones explícitas de consentimientos y documentos
    expect(mockInsertConsents).toHaveBeenCalledTimes(1);
    expect(mockInsertConsents).toHaveBeenCalledWith([
      { profile_id: currentUserId, document: 'tos', version: '1.0' },
      { profile_id: currentUserId, document: 'privacy', version: '1.0' },
      { profile_id: currentUserId, document: 'courier_contract', version: '1.0' },
    ]);

    expect(mockUpsertDocuments).toHaveBeenCalledTimes(1);
    expect(mockUpsertDocuments).toHaveBeenCalledWith([
      {
        courier_id: currentUserId,
        kind: 'dni_front',
        storage_path: 'courier/courier-current-user-uuid/dni_front_1.jpg',
        status: 'submitted',
      },
      {
        courier_id: currentUserId,
        kind: 'dni_back',
        storage_path: 'courier/courier-current-user-uuid/dni_back_1.jpg',
        status: 'submitted',
      },
      {
        courier_id: currentUserId,
        kind: 'selfie',
        storage_path: 'courier/courier-current-user-uuid/selfie_1.jpg',
        status: 'submitted',
      },
      {
        courier_id: currentUserId,
        kind: 'avatar',
        storage_path: 'courier/courier-current-user-uuid/avatar_1.jpg',
        status: 'submitted',
      },
    ]);
  });

  it.each([
    ['tosVersion desactualizada', { tosVersion: '0.9', privacyVersion: '1.0', courierContractVersion: '1.0' }],
    ['privacyVersion desactualizada', { tosVersion: '1.0', privacyVersion: '0.9', courierContractVersion: '1.0' }],
    ['courierContractVersion desactualizada', { tosVersion: '1.0', privacyVersion: '1.0', courierContractVersion: '0.9' }],
  ])(
    'rechaza con VALIDATION_ERROR si %s sin modificar courier ni insertar consents ni documents (H05)',
    async (_label, consentVersions) => {
      const mockAdminUpdate = vi.fn();
      const mockInsertConsents = vi.fn();
      const mockUpsertDocuments = vi.fn();

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
      } as unknown as Awaited<ReturnType<typeof serverAuth.createClient>>);

      vi.mocked(adminAuth.createAdminClient).mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'couriers') {
            return {
              update: mockAdminUpdate,
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
          return {};
        }),
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
          ...consentVersions,
        },
      });

      expect(result).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
      expect(mockAdminUpdate).not.toHaveBeenCalled();
      expect(mockInsertConsents).not.toHaveBeenCalled();
      expect(mockUpsertDocuments).not.toHaveBeenCalled();
    }
  );
});
