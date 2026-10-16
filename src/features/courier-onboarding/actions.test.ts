import { describe, expect, it, vi, beforeEach } from 'vitest';
import { courierOnboardingAction, updateCourierVehicleAction } from './actions';
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
        privacyVersion: '1.1',
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
        privacyVersion: '1.1',
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
        privacyVersion: '1.1',
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
        privacyVersion: '1.1',
        courierContractVersion: '1.0',
      },
    });

    expect(result).toEqual({ ok: false, code: 'DNI_ALREADY_REGISTERED' });

    // PR77-H06: Verificación de que el mock se llame con la columna 'dni_hmac'
    expect(mockAdminEq).toHaveBeenCalledWith('dni_hmac', expectedHmac);
  });

  it('permite el onboarding si el DNI es nuevo y registra datos, consentimientos y documentos', async () => {
    const mockUpdateCourier = vi.fn().mockResolvedValue({ error: null });
    const mockUpsertConsents = vi.fn().mockResolvedValue({ error: null });
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
            insert: mockUpsertConsents,
            upsert: mockUpsertConsents,
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
          insert: mockUpsertConsents,
          upsert: mockUpsertConsents,
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
        privacyVersion: '1.1',
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

    // PR77-H03 / H13: Afirmaciones explícitas de consentimientos idempotentes con ignoreDuplicates
    expect(mockUpsertConsents).toHaveBeenCalledTimes(1);
    expect(mockUpsertConsents).toHaveBeenCalledWith(
      [
        { profile_id: currentUserId, document: 'tos', version: '1.0' },
        { profile_id: currentUserId, document: 'privacy', version: '1.1' },
        { profile_id: currentUserId, document: 'courier_contract', version: '1.0' },
      ],
      {
        onConflict: 'profile_id,document,version',
        ignoreDuplicates: true,
      }
    );

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
    ['tosVersion desactualizada', { tosVersion: '0.9', privacyVersion: '1.1', courierContractVersion: '1.0' }],
    ['privacyVersion desactualizada', { tosVersion: '1.0', privacyVersion: '1.0', courierContractVersion: '1.0' }],
    ['courierContractVersion desactualizada', { tosVersion: '1.0', privacyVersion: '1.1', courierContractVersion: '0.9' }],
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
              upsert: mockInsertConsents,
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

  interface FakeConsentRow {
    profile_id: string;
    document: string;
    version: string;
    accepted_at: string;
  }

  function createConsentsStatefulFake(
    initialRows: Array<{ profile_id: string; document: string; version: string; accepted_at?: string }> = []
  ) {
    const store = new Map<string, FakeConsentRow>();
    for (const r of initialRows) {
      store.set(`${r.profile_id}:${r.document}:${r.version}`, {
        profile_id: r.profile_id,
        document: r.document,
        version: r.version,
        accepted_at: r.accepted_at || '2026-09-01T00:00:00.000Z',
      });
    }

    const queryBuilder = {
      insert: vi.fn(async (payload: unknown) => {
        const rows = Array.isArray(payload) ? payload : [payload];
        for (const row of rows as Array<{ profile_id: string; document: string; version: string }>) {
          const key = `${row.profile_id}:${row.document}:${row.version}`;
          if (store.has(key)) {
            return {
              data: null,
              error: {
                code: '23505',
                message: 'duplicate key value violates unique constraint "consents_pkey"',
              },
            };
          }
        }
        for (const row of rows as Array<{ profile_id: string; document: string; version: string }>) {
          const key = `${row.profile_id}:${row.document}:${row.version}`;
          store.set(key, { ...row, accepted_at: new Date().toISOString() });
        }
        return { data: rows, error: null };
      }),

      upsert: vi.fn(async (payload: unknown, options?: { onConflict?: string; ignoreDuplicates?: boolean }) => {
        const rows = Array.isArray(payload) ? payload : [payload];
        for (const row of rows as Array<{ profile_id: string; document: string; version: string }>) {
          const key = `${row.profile_id}:${row.document}:${row.version}`;
          if (store.has(key)) {
            if (!options?.ignoreDuplicates) {
              return {
                data: null,
                error: {
                  code: '23505',
                  message: 'duplicate key value violates unique constraint "consents_pkey"',
                },
              };
            }
            // ignoreDuplicates: true -> conserva fila existente y su accepted_at original
            continue;
          }
          store.set(key, { ...row, accepted_at: new Date().toISOString() });
        }
        return { data: rows, error: null };
      }),
    };

    return { store, queryBuilder };
  }

  it('courier posterior a registro con TOS/Privacy preexistentes: onboarding no falla por duplicado, persiste courier_contract y preserva accepted_at (H13/H14)', async () => {
    const tosAcceptedAt = '2026-09-01T10:00:00.000Z';
    const privacyAcceptedAt = '2026-09-01T10:05:00.000Z';
    const fakeConsents = createConsentsStatefulFake([
      { profile_id: currentUserId, document: 'tos', version: '1.0', accepted_at: tosAcceptedAt },
      { profile_id: currentUserId, document: 'privacy', version: '1.1', accepted_at: privacyAcceptedAt },
    ]);

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
        if (table === 'courier_documents') {
          return { upsert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    } as unknown as Awaited<ReturnType<typeof serverAuth.createClient>>);

    const mockAdminFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'couriers') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'consents') {
        return fakeConsents.queryBuilder;
      }
      if (table === 'courier_documents') {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
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
        privacyVersion: '1.1',
        courierContractVersion: '1.0',
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.redirectTo).toBe('/onboarding/status');
    }
    // Preserva los timestamps históricos de TOS y Privacy sin sobrescribir
    expect(fakeConsents.store.get(`${currentUserId}:tos:1.0`)?.accepted_at).toBe(tosAcceptedAt);
    expect(fakeConsents.store.get(`${currentUserId}:privacy:1.1`)?.accepted_at).toBe(privacyAcceptedAt);
    // Inserta courier_contract nuevo
    expect(fakeConsents.store.has(`${currentUserId}:courier_contract:1.0`)).toBe(true);
  });

  it('reintento courier después de fallo posterior: no falla aunque todos los consentimientos ya existan y no reescribe accepted_at (H13/H14)', async () => {
    const initialTimestamp = '2026-09-01T10:00:00.000Z';
    const fakeConsents = createConsentsStatefulFake([
      { profile_id: currentUserId, document: 'tos', version: '1.0', accepted_at: initialTimestamp },
      { profile_id: currentUserId, document: 'privacy', version: '1.1', accepted_at: initialTimestamp },
      { profile_id: currentUserId, document: 'courier_contract', version: '1.0', accepted_at: initialTimestamp },
    ]);

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
        if (table === 'courier_documents') {
          return { upsert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    } as unknown as Awaited<ReturnType<typeof serverAuth.createClient>>);

    const mockAdminFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'couriers') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'consents') {
        return fakeConsents.queryBuilder;
      }
      if (table === 'courier_documents') {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
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
        privacyVersion: '1.1',
        courierContractVersion: '1.0',
      },
    });

    expect(result.ok).toBe(true);
    expect(fakeConsents.store.get(`${currentUserId}:tos:1.0`)?.accepted_at).toBe(initialTimestamp);
    expect(fakeConsents.store.get(`${currentUserId}:privacy:1.1`)?.accepted_at).toBe(initialTimestamp);
    expect(fakeConsents.store.get(`${currentUserId}:courier_contract:1.0`)?.accepted_at).toBe(initialTimestamp);
  });
});

describe('T-334 / PR240-H02: vehicle_type se escribe solo al final de un onboarding exitoso', () => {
  const currentUserId = 'courier-current-user-uuid';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** Mismo cableado que el happy path; solo cambia el error del paso que falla. */
  function setupClients(failures: { consents?: boolean; documents?: boolean }) {
    const consentsResult = {
      error: failures.consents ? { message: 'consents write failed' } : null,
    };
    const mockUpsertConsents = vi.fn().mockResolvedValue(consentsResult);
    const mockUpsertDocuments = vi.fn().mockResolvedValue({
      error: failures.documents ? { message: 'courier_documents write failed' } : null,
    });

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
        if (table === 'courier_documents') {
          return { upsert: mockUpsertDocuments };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    } as unknown as Awaited<ReturnType<typeof serverAuth.createClient>>);

    const mockAdminUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    vi.mocked(adminAuth.createAdminClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'couriers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            update: mockAdminUpdate,
          };
        }
        if (table === 'consents') {
          return { upsert: mockUpsertConsents };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    } as unknown as ReturnType<typeof adminAuth.createAdminClient>);

    return { mockAdminUpdate, mockUpsertConsents, mockUpsertDocuments };
  }

  const validInput = {
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
      privacyVersion: '1.1',
      courierContractVersion: '1.0',
    },
  };

  it('si falla el upsert de consentimientos, no se escribe el marcador del courier', async () => {
    const { mockAdminUpdate, mockUpsertConsents } = setupClients({ consents: true });

    const result = await courierOnboardingAction(validInput);

    expect(mockUpsertConsents).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false, code: 'INTERNAL_ERROR' });
    expect(mockAdminUpdate).not.toHaveBeenCalled();
  });

  it('si falla el upsert de documentos, no se escribe el marcador del courier', async () => {
    const { mockAdminUpdate, mockUpsertDocuments } = setupClients({ documents: true });

    const result = await courierOnboardingAction(validInput);

    expect(mockUpsertDocuments).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false, code: 'INTERNAL_ERROR' });
    expect(mockAdminUpdate).not.toHaveBeenCalled();
  });

  describe('T-353 / PR362-H03 / PR362-H05: validación semántica y no escritura en Action real', () => {
    it('rechaza DNI con letras o formato inválido con VALIDATION_ERROR y no realiza escrituras en base de datos', async () => {
      const { mockAdminUpdate, mockUpsertConsents, mockUpsertDocuments } = setupClients({});

      const invalidInput = {
        ...validInput,
        dni: '1234567A', // Letra inválida en DNI
      };

      const result = await courierOnboardingAction(invalidInput);

      expect(result).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
      expect(mockAdminUpdate).not.toHaveBeenCalled();
      expect(mockUpsertConsents).not.toHaveBeenCalled();
      expect(mockUpsertDocuments).not.toHaveBeenCalled();
    });

    it('normaliza vehicle_plate a null en couriers.update para walk y bike aun si el payload contenía patente (Decisión 2A)', async () => {
      const { mockAdminUpdate } = setupClients({});

      const walkInputWithPlate = {
        ...validInput,
        vehicleType: 'walk',
        vehiclePlate: 'TEXTO_ARBITRARIO_QUE_NO_DEBERIA_PERSISTIR',
      };

      const result = await courierOnboardingAction(walkInputWithPlate);

      expect(result.ok).toBe(true);
      expect(mockAdminUpdate).toHaveBeenCalledTimes(1);
      const firstCall = mockAdminUpdate.mock.calls[0];
      expect(firstCall?.[0]).toMatchObject({
        vehicle_type: 'walk',
        vehicle_plate: null,
      });
    });
  });

  describe('T-357: Actualización de vehículo del repartidor desde perfil (updateCourierVehicleAction)', () => {
    const courierId = 'courier-test-uuid-357';

    function setupCourierMock({
      user = { id: courierId, email: 'courier@cadeapp.test' } as { id: string; email: string } | null,
      role = 'courier',
      courierRecord = { profile_id: courierId, status: 'approved' } as { profile_id: string; status: string } | null,
      updateFails = false,
      documentsFails = false,
    } = {}) {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: updateFails ? { message: 'db error' } : null,
        }),
      });
      const mockUpsertDocuments = vi.fn().mockResolvedValue({
        error: documentsFails ? { message: 'docs error' } : null,
      });

      vi.mocked(serverAuth.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user },
            error: user ? null : new Error('No auth'),
          }),
        },
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: user && role ? { role } : null,
                error: null,
              }),
            };
          }
          if (table === 'couriers') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: courierRecord,
                error: null,
              }),
              update: mockUpdate,
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

      return { mockUpdate, mockUpsertDocuments };
    }

    it('rechaza la acción si el usuario no está autenticado', async () => {
      setupCourierMock({ user: null });
      const result = await updateCourierVehicleAction({
        vehicleType: 'moto',
        vehiclePlate: 'AB 123 CD',
      });
      expect(result).toEqual({ ok: false, code: 'UNAUTHENTICATED' });
    });

    it('rechaza la acción si el usuario autenticado no tiene rol courier', async () => {
      setupCourierMock({ role: 'merchant' });
      const result = await updateCourierVehicleAction({
        vehicleType: 'moto',
        vehiclePlate: 'AB 123 CD',
      });
      expect(result).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
    });

    it('rechaza la acción si el legajo courier no existe (NOT_FOUND)', async () => {
      setupCourierMock({ courierRecord: null });
      const result = await updateCourierVehicleAction({
        vehicleType: 'moto',
        vehiclePlate: 'AB 123 CD',
      });
      expect(result).toEqual({ ok: false, code: 'NOT_FOUND' });
    });

    it('rechaza la acción si el tipo de transporte no es válido (VALIDATION_ERROR)', async () => {
      setupCourierMock();
      const result = await updateCourierVehicleAction({
        vehicleType: 'helicoptero',
        vehiclePlate: 'AB 123 CD',
      });
      expect(result).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
    });

    it('rechaza la acción si el vehículo es moto y no tiene patente', async () => {
      setupCourierMock();
      const result = await updateCourierVehicleAction({
        vehicleType: 'moto',
        vehiclePlate: '',
      });
      expect(result).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
    });

    it('rechaza la acción si la patente tiene formato inválido para moto o auto', async () => {
      setupCourierMock();
      const result = await updateCourierVehicleAction({
        vehicleType: 'car',
        vehiclePlate: 'PATENTE_INVALIDA_123',
      });
      expect(result).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
    });

    it('actualiza exitosamente moto con patente argentina formateada a mayúsculas', async () => {
      const { mockUpdate } = setupCourierMock();
      const result = await updateCourierVehicleAction({
        vehicleType: 'moto',
        vehiclePlate: 'ab 123 cd',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.redirectTo).toBe('/courier/profile');
      }
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate.mock.calls[0]?.[0]).toEqual({
        vehicle_type: 'moto',
        vehicle_plate: 'AB 123 CD',
      });
    });

    it('actualiza exitosamente a pie o bici normalizando vehicle_plate a null', async () => {
      const { mockUpdate } = setupCourierMock();
      const result = await updateCourierVehicleAction({
        vehicleType: 'bike',
        vehiclePlate: 'AB 123 CD', // si viniera residuo de patente, debe normalizarse a null
      });

      expect(result.ok).toBe(true);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate.mock.calls[0]?.[0]).toEqual({
        vehicle_type: 'bike',
        vehicle_plate: null,
      });
    });

    it('persiste documentos opcionales (licencia y seguro) si son provistos', async () => {
      const { mockUpdate, mockUpsertDocuments } = setupCourierMock();
      const result = await updateCourierVehicleAction({
        vehicleType: 'moto',
        vehiclePlate: 'AB 123 CD',
        documents: {
          license: 'courier/courier-test-uuid-357/license.jpg',
          insurance: 'courier/courier-test-uuid-357/insurance.jpg',
        },
      });

      expect(result.ok).toBe(true);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpsertDocuments).toHaveBeenCalledTimes(1);
      const docsArg = mockUpsertDocuments.mock.calls[0]?.[0] as Array<{ kind: string; storage_path: string }>;
      expect(docsArg).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: 'license', storage_path: 'courier/courier-test-uuid-357/license.jpg', status: 'submitted' }),
          expect.objectContaining({ kind: 'insurance', storage_path: 'courier/courier-test-uuid-357/insurance.jpg', status: 'submitted' }),
        ])
      );
    });

    it('no exige reconsentimientos legales ni DNI/selfie en la edición', async () => {
      const { mockUpdate } = setupCourierMock();
      // Payload sin consents ni DNI
      const result = await updateCourierVehicleAction({
        vehicleType: 'car',
        vehiclePlate: 'AA 000 BB',
      });
      expect(result.ok).toBe(true);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });
  });
});
