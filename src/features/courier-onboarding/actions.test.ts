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
    const mockInsertDocuments = vi.fn().mockResolvedValue({ error: null });

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
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            insert: mockInsertDocuments,
            upsert: vi.fn().mockResolvedValue({
              error: { code: '42501', message: 'permission denied for table courier_documents (UPDATE revoked)' },
            }),
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

    expect(mockInsertDocuments).toHaveBeenCalledTimes(1);
    expect(mockInsertDocuments).toHaveBeenCalledWith([
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
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
            upsert: vi.fn().mockResolvedValue({
              error: { code: '42501', message: 'permission denied for table courier_documents (UPDATE revoked)' },
            }),
          };
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
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
            upsert: vi.fn().mockResolvedValue({
              error: { code: '42501', message: 'permission denied for table courier_documents (UPDATE revoked)' },
            }),
          };
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
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            insert: mockUpsertDocuments,
            upsert: vi.fn().mockResolvedValue({
              error: { code: '42501', message: 'permission denied for table courier_documents (UPDATE revoked)' },
            }),
          };
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

  describe('PR364-H05 y PR364-R01: Idempotencia y compatibilidad de alta de documentos con INSERT autorizado (sin UPSERT)', () => {
    const validOnboardingPayload = {
      dni: '38123456',
      vehicleType: 'moto' as const,
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

    it('a) primer onboarding con cuatro kinds sin docs: llamada .insert con array idéntico y cero .upsert', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      const mockUpsert = vi.fn().mockResolvedValue({
        error: { code: '42501', message: 'permission denied for table courier_documents (UPDATE revoked)' },
      });
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
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
            return {
              select: mockSelect,
              insert: mockInsert,
              upsert: mockUpsert,
            };
          }
          return { select: vi.fn().mockReturnThis() };
        }),
      } as unknown as Awaited<ReturnType<typeof serverAuth.createClient>>);

      const mockAdminUpdate = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(adminAuth.createAdminClient).mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'couriers') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              update: vi.fn().mockReturnValue({ eq: mockAdminUpdate }),
            };
          }
          if (table === 'consents') {
            return { upsert: vi.fn().mockResolvedValue({ error: null }) };
          }
          return {};
        }),
      } as unknown as ReturnType<typeof adminAuth.createAdminClient>);

      const result = await courierOnboardingAction(validOnboardingPayload);

      expect(result).toEqual({ ok: true, data: { redirectTo: '/onboarding/status' } });
      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockInsert).toHaveBeenCalledWith([
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
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(mockAdminUpdate).toHaveBeenCalledTimes(1);
    });

    it('b) reintento con mismos kinds/path existentes: SELECT detecta coincidencia y realiza cero writes', async () => {
      const mockInsert = vi.fn();
      const mockUpsert = vi.fn().mockResolvedValue({
        error: { code: '42501', message: 'permission denied' },
      });
      const existingDocs = [
        { id: 'doc-1', kind: 'dni_front', storage_path: 'courier/courier-current-user-uuid/dni_front_1.jpg', status: 'submitted', is_current: true },
        { id: 'doc-2', kind: 'dni_back', storage_path: 'courier/courier-current-user-uuid/dni_back_1.jpg', status: 'submitted', is_current: true },
        { id: 'doc-3', kind: 'selfie', storage_path: 'courier/courier-current-user-uuid/selfie_1.jpg', status: 'submitted', is_current: true },
        { id: 'doc-4', kind: 'avatar', storage_path: 'courier/courier-current-user-uuid/avatar_1.jpg', status: 'submitted', is_current: true },
      ];

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
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: existingDocs, error: null }),
              }),
              insert: mockInsert,
              upsert: mockUpsert,
            };
          }
          return { select: vi.fn().mockReturnThis() };
        }),
      } as unknown as Awaited<ReturnType<typeof serverAuth.createClient>>);

      const mockAdminUpdate = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(adminAuth.createAdminClient).mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'couriers') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              update: vi.fn().mockReturnValue({ eq: mockAdminUpdate }),
            };
          }
          if (table === 'consents') {
            return { upsert: vi.fn().mockResolvedValue({ error: null }) };
          }
          return {};
        }),
      } as unknown as ReturnType<typeof adminAuth.createAdminClient>);

      const result = await courierOnboardingAction(validOnboardingPayload);

      expect(result).toEqual({ ok: true, data: { redirectTo: '/onboarding/status' } });
      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(mockAdminUpdate).toHaveBeenCalledTimes(1);
    });

    it('c) reintento con path distinto sobre documento vigente: retorna VALIDATION_ERROR y cero writes', async () => {
      const mockInsert = vi.fn();
      const mockUpsert = vi.fn();
      const existingDocs = [
        { id: 'doc-1', kind: 'dni_front', storage_path: 'courier/courier-current-user-uuid/dni_front_OTHER.jpg', status: 'submitted', is_current: true },
        { id: 'doc-2', kind: 'dni_back', storage_path: 'courier/courier-current-user-uuid/dni_back_1.jpg', status: 'submitted', is_current: true },
        { id: 'doc-3', kind: 'selfie', storage_path: 'courier/courier-current-user-uuid/selfie_1.jpg', status: 'submitted', is_current: true },
        { id: 'doc-4', kind: 'avatar', storage_path: 'courier/courier-current-user-uuid/avatar_1.jpg', status: 'submitted', is_current: true },
      ];

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
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: existingDocs, error: null }),
              }),
              insert: mockInsert,
              upsert: mockUpsert,
            };
          }
          return { select: vi.fn().mockReturnThis() };
        }),
      } as unknown as Awaited<ReturnType<typeof serverAuth.createClient>>);

      vi.mocked(adminAuth.createAdminClient).mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'couriers') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }
          if (table === 'consents') {
            return { upsert: vi.fn().mockResolvedValue({ error: null }) };
          }
          return {};
        }),
      } as unknown as ReturnType<typeof adminAuth.createAdminClient>);

      const result = await courierOnboardingAction(validOnboardingPayload);

      expect(result).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('d) tras SELECT inicial vacío, INSERT da 23505 (carrera concurrente) y segundo SELECT muestra mismos 4 kinds/path: éxito idempotente', async () => {
      const concurrentDocs = [
        { id: 'doc-1', kind: 'dni_front', storage_path: 'courier/courier-current-user-uuid/dni_front_1.jpg', status: 'submitted', is_current: true },
        { id: 'doc-2', kind: 'dni_back', storage_path: 'courier/courier-current-user-uuid/dni_back_1.jpg', status: 'submitted', is_current: true },
        { id: 'doc-3', kind: 'selfie', storage_path: 'courier/courier-current-user-uuid/selfie_1.jpg', status: 'submitted', is_current: true },
        { id: 'doc-4', kind: 'avatar', storage_path: 'courier/courier-current-user-uuid/avatar_1.jpg', status: 'submitted', is_current: true },
      ];

      let selectCallCount = 0;
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return Promise.resolve({ data: [], error: null });
          }
          return Promise.resolve({ data: concurrentDocs, error: null });
        }),
      });

      const mockInsert = vi.fn().mockResolvedValue({
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint courier_documents_unique_current',
        },
      });
      const mockUpsert = vi.fn().mockResolvedValue({
        error: { code: '42501', message: 'permission denied' },
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
            return {
              select: mockSelect,
              insert: mockInsert,
              upsert: mockUpsert,
            };
          }
          return { select: vi.fn().mockReturnThis() };
        }),
      } as unknown as Awaited<ReturnType<typeof serverAuth.createClient>>);

      const mockAdminUpdate = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(adminAuth.createAdminClient).mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'couriers') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              update: vi.fn().mockReturnValue({ eq: mockAdminUpdate }),
            };
          }
          if (table === 'consents') {
            return { upsert: vi.fn().mockResolvedValue({ error: null }) };
          }
          return {};
        }),
      } as unknown as ReturnType<typeof adminAuth.createAdminClient>);

      const result = await courierOnboardingAction(validOnboardingPayload);

      expect(result).toEqual({ ok: true, data: { redirectTo: '/onboarding/status' } });
      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(selectCallCount).toBe(2);
      expect(mockAdminUpdate).toHaveBeenCalledTimes(1);
    });

    it('e) tras SELECT inicial vacío, INSERT da 23505 y segundo SELECT muestra path distinto o falta de kind: rechazar con VALIDATION_ERROR', async () => {
      const conflictingDocs = [
        { id: 'doc-1', kind: 'dni_front', storage_path: 'courier/courier-current-user-uuid/dni_front_DIFFERENT.jpg', status: 'submitted', is_current: true },
        { id: 'doc-2', kind: 'dni_back', storage_path: 'courier/courier-current-user-uuid/dni_back_1.jpg', status: 'submitted', is_current: true },
        { id: 'doc-3', kind: 'selfie', storage_path: 'courier/courier-current-user-uuid/selfie_1.jpg', status: 'submitted', is_current: true },
        { id: 'doc-4', kind: 'avatar', storage_path: 'courier/courier-current-user-uuid/avatar_1.jpg', status: 'submitted', is_current: true },
      ];

      let selectCallCount = 0;
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return Promise.resolve({ data: [], error: null });
          }
          return Promise.resolve({ data: conflictingDocs, error: null });
        }),
      });

      const mockInsert = vi.fn().mockResolvedValue({
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
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
            return {
              select: mockSelect,
              insert: mockInsert,
              upsert: vi.fn(),
            };
          }
          return { select: vi.fn().mockReturnThis() };
        }),
      } as unknown as Awaited<ReturnType<typeof serverAuth.createClient>>);

      vi.mocked(adminAuth.createAdminClient).mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'couriers') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }
          if (table === 'consents') {
            return { upsert: vi.fn().mockResolvedValue({ error: null }) };
          }
          return {};
        }),
      } as unknown as ReturnType<typeof adminAuth.createAdminClient>);

      const result = await courierOnboardingAction(validOnboardingPayload);

      expect(result).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
      expect(selectCallCount).toBe(2);
    });

    it('f) fallo en DB distinto de 23505 en INSERT: retorna INTERNAL_ERROR', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      });
      const mockInsert = vi.fn().mockResolvedValue({
        error: { code: 'P0001', message: 'connection failure' },
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
            return {
              select: mockSelect,
              insert: mockInsert,
              upsert: vi.fn(),
            };
          }
          return { select: vi.fn().mockReturnThis() };
        }),
      } as unknown as Awaited<ReturnType<typeof serverAuth.createClient>>);

      vi.mocked(adminAuth.createAdminClient).mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'couriers') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }
          if (table === 'consents') {
            return { upsert: vi.fn().mockResolvedValue({ error: null }) };
          }
          return {};
        }),
      } as unknown as ReturnType<typeof adminAuth.createAdminClient>);

      const result = await courierOnboardingAction(validOnboardingPayload);

      expect(result).toEqual({ ok: false, code: 'INTERNAL_ERROR' });
    });

    it('g) nunca toca documentos en estado verified o submitted salvo la lectura', async () => {
      const mockInsert = vi.fn();
      const mockUpsert = vi.fn();
      const existingDocs = [
        { id: 'doc-1', kind: 'dni_front', storage_path: 'courier/courier-current-user-uuid/dni_front_1.jpg', status: 'verified', is_current: true },
        { id: 'doc-2', kind: 'dni_back', storage_path: 'courier/courier-current-user-uuid/dni_back_1.jpg', status: 'verified', is_current: true },
        { id: 'doc-3', kind: 'selfie', storage_path: 'courier/courier-current-user-uuid/selfie_1.jpg', status: 'submitted', is_current: true },
        { id: 'doc-4', kind: 'avatar', storage_path: 'courier/courier-current-user-uuid/avatar_1.jpg', status: 'submitted', is_current: true },
      ];

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
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: existingDocs, error: null }),
              }),
              insert: mockInsert,
              upsert: mockUpsert,
            };
          }
          return { select: vi.fn().mockReturnThis() };
        }),
      } as unknown as Awaited<ReturnType<typeof serverAuth.createClient>>);

      const mockAdminUpdate = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(adminAuth.createAdminClient).mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'couriers') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              update: vi.fn().mockReturnValue({ eq: mockAdminUpdate }),
            };
          }
          if (table === 'consents') {
            return { upsert: vi.fn().mockResolvedValue({ error: null }) };
          }
          return {};
        }),
      } as unknown as ReturnType<typeof adminAuth.createAdminClient>);

      const result = await courierOnboardingAction(validOnboardingPayload);

      expect(result).toEqual({ ok: true, data: { redirectTo: '/onboarding/status' } });
      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(mockAdminUpdate).toHaveBeenCalledTimes(1);
    });

    it('h) PR364-R03: tras SELECT inicial vacío, INSERT devuelve 42501 (RLS por not exists) y segundo SELECT muestra mismos 4 kinds/path con consent activo -> éxito idempotente', async () => {
      const insertedDocs = [
        { id: 'doc-1', kind: 'dni_front', storage_path: 'courier/courier-current-user-uuid/dni_front_1.jpg', status: 'submitted', is_current: true },
        { id: 'doc-2', kind: 'dni_back', storage_path: 'courier/courier-current-user-uuid/dni_back_1.jpg', status: 'submitted', is_current: true },
        { id: 'doc-3', kind: 'selfie', storage_path: 'courier/courier-current-user-uuid/selfie_1.jpg', status: 'submitted', is_current: true },
        { id: 'doc-4', kind: 'avatar', storage_path: 'courier/courier-current-user-uuid/avatar_1.jpg', status: 'submitted', is_current: true },
      ];

      let selectCallCount = 0;
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return Promise.resolve({ data: [], error: null });
          }
          return Promise.resolve({ data: insertedDocs, error: null });
        }),
      });

      const mockInsert = vi.fn().mockResolvedValue({
        error: {
          code: '42501',
          message: 'new row violates row-level security policy for table "courier_documents"',
        },
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
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: currentUserId, role: 'courier', consent_status: 'active' },
                error: null,
              }),
            };
          }
          if (table === 'courier_documents') {
            return {
              select: mockSelect,
              insert: mockInsert,
              upsert: vi.fn(),
            };
          }
          return { select: vi.fn().mockReturnThis() };
        }),
      } as unknown as Awaited<ReturnType<typeof serverAuth.createClient>>);

      const mockAdminUpdate = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(adminAuth.createAdminClient).mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'couriers') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              update: vi.fn().mockReturnValue({ eq: mockAdminUpdate }),
            };
          }
          if (table === 'consents') {
            return { upsert: vi.fn().mockResolvedValue({ error: null }) };
          }
          return {};
        }),
      } as unknown as ReturnType<typeof adminAuth.createAdminClient>);

      const result = await courierOnboardingAction(validOnboardingPayload);

      expect(result).toEqual({ ok: true, data: { redirectTo: '/onboarding/status' } });
      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(selectCallCount).toBe(2);
      expect(mockAdminUpdate).toHaveBeenCalledTimes(1);
    });

    it('i) PR364-R03: tras SELECT inicial vacío, INSERT devuelve 42501 (RLS) y segundo SELECT muestra path discrepante: rechazar con VALIDATION_ERROR', async () => {
      const conflictingDocs = [
        { id: 'doc-1', kind: 'dni_front', storage_path: 'courier/courier-current-user-uuid/dni_front_OTHER.jpg', status: 'submitted', is_current: true },
        { id: 'doc-2', kind: 'dni_back', storage_path: 'courier/courier-current-user-uuid/dni_back_1.jpg', status: 'submitted', is_current: true },
        { id: 'doc-3', kind: 'selfie', storage_path: 'courier/courier-current-user-uuid/selfie_1.jpg', status: 'submitted', is_current: true },
        { id: 'doc-4', kind: 'avatar', storage_path: 'courier/courier-current-user-uuid/avatar_1.jpg', status: 'submitted', is_current: true },
      ];

      let selectCallCount = 0;
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return Promise.resolve({ data: [], error: null });
          }
          return Promise.resolve({ data: conflictingDocs, error: null });
        }),
      });

      const mockInsert = vi.fn().mockResolvedValue({
        error: {
          code: '42501',
          message: 'new row violates row-level security policy for table "courier_documents"',
        },
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
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: currentUserId, role: 'courier', consent_status: 'active' },
                error: null,
              }),
            };
          }
          if (table === 'courier_documents') {
            return {
              select: mockSelect,
              insert: mockInsert,
              upsert: vi.fn(),
            };
          }
          return { select: vi.fn().mockReturnThis() };
        }),
      } as unknown as Awaited<ReturnType<typeof serverAuth.createClient>>);

      vi.mocked(adminAuth.createAdminClient).mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'couriers') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }
          if (table === 'consents') {
            return { upsert: vi.fn().mockResolvedValue({ error: null }) };
          }
          return {};
        }),
      } as unknown as ReturnType<typeof adminAuth.createAdminClient>);

      const result = await courierOnboardingAction(validOnboardingPayload);

      expect(result).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
      expect(selectCallCount).toBe(2);
    });

    it('j) PR364-R03: tras SELECT inicial vacío, INSERT devuelve 42501 pero el actor tiene consent_status pendiente: rechazar con UNAUTHORIZED_ACTOR', async () => {
      let selectCallCount = 0;
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation(() => {
          selectCallCount++;
          return Promise.resolve({ data: [], error: null });
        }),
      });

      const mockInsert = vi.fn().mockResolvedValue({
        error: {
          code: '42501',
          message: 'new row violates row-level security policy for table "courier_documents"',
        },
      });

      let profileSelectCount = 0;
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
              maybeSingle: vi.fn().mockImplementation(() => {
                profileSelectCount++;
                if (profileSelectCount === 1) {
                  return Promise.resolve({ data: { role: 'courier' }, error: null });
                }
                return Promise.resolve({
                  data: { id: currentUserId, role: 'courier', consent_status: 'pending' },
                  error: null,
                });
              }),
            };
          }
          if (table === 'courier_documents') {
            return {
              select: mockSelect,
              insert: mockInsert,
              upsert: vi.fn(),
            };
          }
          return { select: vi.fn().mockReturnThis() };
        }),
      } as unknown as Awaited<ReturnType<typeof serverAuth.createClient>>);

      vi.mocked(adminAuth.createAdminClient).mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'couriers') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }
          if (table === 'consents') {
            return { upsert: vi.fn().mockResolvedValue({ error: null }) };
          }
          return {};
        }),
      } as unknown as ReturnType<typeof adminAuth.createAdminClient>);

      const result = await courierOnboardingAction(validOnboardingPayload);

      expect(result).toEqual({ ok: false, code: 'UNAUTHORIZED_ACTOR' });
    });

    it('k) PR364-R03: simulación de interleaving real de dos sesiones: A lee vacío, B commitea documentos, A intenta INSERT y recupera idempotentemente vía RLS 42501', async () => {
      const dbDocuments: Array<{ id: string; kind: string; storage_path: string; status: string; is_current: boolean }> = [];

      const mockSessionASelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation(() => {
          return Promise.resolve({ data: [...dbDocuments], error: null });
        }),
      });

      const mockSessionAInsert = vi.fn().mockImplementation((entries: Array<any>) => {
        for (const entry of entries) {
          if (dbDocuments.some((d) => d.kind === entry.kind && d.is_current)) {
            return Promise.resolve({
              error: {
                code: '42501',
                message: 'new row violates row-level security policy for table "courier_documents"',
              },
            });
          }
        }
        dbDocuments.push(...entries.map((e, idx) => ({ id: `doc-${idx}`, ...e, is_current: true })));
        return Promise.resolve({ error: null });
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
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: currentUserId, role: 'courier', consent_status: 'active' },
                error: null,
              }),
            };
          }
          if (table === 'courier_documents') {
            return {
              select: mockSessionASelect,
              insert: mockSessionAInsert,
              upsert: vi.fn(),
            };
          }
          return { select: vi.fn().mockReturnThis() };
        }),
      } as unknown as Awaited<ReturnType<typeof serverAuth.createClient>>);

      const mockAdminUpdate = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(adminAuth.createAdminClient).mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'couriers') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              update: vi.fn().mockReturnValue({ eq: mockAdminUpdate }),
            };
          }
          if (table === 'consents') {
            return { upsert: vi.fn().mockResolvedValue({ error: null }) };
          }
          return {};
        }),
      } as unknown as ReturnType<typeof adminAuth.createAdminClient>);

      // En el snapshot inicial, Sesión A lee vacío []. Justo después, Sesión B commitea en DB:
      mockSessionASelect.mockReturnValueOnce({
        eq: vi.fn().mockImplementation(() => {
          dbDocuments.push(
            { id: 'b-1', kind: 'dni_front', storage_path: 'courier/courier-current-user-uuid/dni_front_1.jpg', status: 'submitted', is_current: true },
            { id: 'b-2', kind: 'dni_back', storage_path: 'courier/courier-current-user-uuid/dni_back_1.jpg', status: 'submitted', is_current: true },
            { id: 'b-3', kind: 'selfie', storage_path: 'courier/courier-current-user-uuid/selfie_1.jpg', status: 'submitted', is_current: true },
            { id: 'b-4', kind: 'avatar', storage_path: 'courier/courier-current-user-uuid/avatar_1.jpg', status: 'submitted', is_current: true },
          );
          return Promise.resolve({ data: [], error: null });
        }),
      });

      const result = await courierOnboardingAction(validOnboardingPayload);

      expect(result).toEqual({ ok: true, data: { redirectTo: '/onboarding/status' } });
      expect(dbDocuments).toHaveLength(4);
      expect(mockAdminUpdate).toHaveBeenCalledTimes(1);
    });

    it('l) Fase B / ambigüedad en lectura inicial: coexisten múltiples filas is_current=true para el mismo kind -> rechaza con INTERNAL_ERROR sin mutar ni llamar a update', async () => {
      const ambiguousDocs = [
        { id: 'doc-1a', kind: 'dni_front', storage_path: 'courier/courier-current-user-uuid/dni_front_1.jpg', status: 'submitted', is_current: true },
        { id: 'doc-1b', kind: 'dni_front', storage_path: 'courier/courier-current-user-uuid/dni_front_OLD.jpg', status: 'submitted', is_current: true },
        { id: 'doc-2', kind: 'dni_back', storage_path: 'courier/courier-current-user-uuid/dni_back_1.jpg', status: 'submitted', is_current: true },
        { id: 'doc-3', kind: 'selfie', storage_path: 'courier/courier-current-user-uuid/selfie_1.jpg', status: 'submitted', is_current: true },
        { id: 'doc-4', kind: 'avatar', storage_path: 'courier/courier-current-user-uuid/avatar_1.jpg', status: 'submitted', is_current: true },
      ];

      const mockInsert = vi.fn();
      const mockUpsert = vi.fn();

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
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: ambiguousDocs, error: null }),
              }),
              insert: mockInsert,
              upsert: mockUpsert,
            };
          }
          return { select: vi.fn().mockReturnThis() };
        }),
      } as unknown as Awaited<ReturnType<typeof serverAuth.createClient>>);

      const mockAdminUpdate = vi.fn();
      vi.mocked(adminAuth.createAdminClient).mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'couriers') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              update: vi.fn().mockReturnValue({ eq: mockAdminUpdate }),
            };
          }
          if (table === 'consents') {
            return { upsert: vi.fn().mockResolvedValue({ error: null }) };
          }
          return {};
        }),
      } as unknown as ReturnType<typeof adminAuth.createAdminClient>);

      const result = await courierOnboardingAction(validOnboardingPayload);

      expect(result).toEqual({ ok: false, code: 'INTERNAL_ERROR' });
      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(mockAdminUpdate).not.toHaveBeenCalled();
    });

    it('m) Fase B / ambigüedad en relectura tras colisión: si la relectura contiene múltiples filas is_current=true del mismo kind -> rechaza con INTERNAL_ERROR', async () => {
      const ambiguousDocsOnRecheck = [
        { id: 'doc-1a', kind: 'dni_front', storage_path: 'courier/courier-current-user-uuid/dni_front_1.jpg', status: 'submitted', is_current: true },
        { id: 'doc-1b', kind: 'dni_front', storage_path: 'courier/courier-current-user-uuid/dni_front_2.jpg', status: 'submitted', is_current: true },
        { id: 'doc-2', kind: 'dni_back', storage_path: 'courier/courier-current-user-uuid/dni_back_1.jpg', status: 'submitted', is_current: true },
        { id: 'doc-3', kind: 'selfie', storage_path: 'courier/courier-current-user-uuid/selfie_1.jpg', status: 'submitted', is_current: true },
        { id: 'doc-4', kind: 'avatar', storage_path: 'courier/courier-current-user-uuid/avatar_1.jpg', status: 'submitted', is_current: true },
      ];

      let selectCallCount = 0;
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return Promise.resolve({ data: [], error: null });
          }
          return Promise.resolve({ data: ambiguousDocsOnRecheck, error: null });
        }),
      });

      const mockInsert = vi.fn().mockResolvedValue({
        error: {
          code: '42501',
          message: 'new row violates row-level security policy for table "courier_documents"',
        },
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
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: currentUserId, role: 'courier', consent_status: 'active' },
                error: null,
              }),
            };
          }
          if (table === 'courier_documents') {
            return {
              select: mockSelect,
              insert: mockInsert,
              upsert: vi.fn(),
            };
          }
          return { select: vi.fn().mockReturnThis() };
        }),
      } as unknown as Awaited<ReturnType<typeof serverAuth.createClient>>);

      const mockAdminUpdate = vi.fn();
      vi.mocked(adminAuth.createAdminClient).mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'couriers') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              update: vi.fn().mockReturnValue({ eq: mockAdminUpdate }),
            };
          }
          if (table === 'consents') {
            return { upsert: vi.fn().mockResolvedValue({ error: null }) };
          }
          return {};
        }),
      } as unknown as ReturnType<typeof adminAuth.createAdminClient>);

      const result = await courierOnboardingAction(validOnboardingPayload);

      expect(result).toEqual({ ok: false, code: 'INTERNAL_ERROR' });
      expect(selectCallCount).toBe(2);
      expect(mockAdminUpdate).not.toHaveBeenCalled();
    });
  });
});
