import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import * as adminSupabase from '@/server/supabase/admin';
import { merchantOnboardingAction } from './actions';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/server/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

describe('T-111: Merchant onboarding action y persistencia de piloto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminSupabase.createAdminClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'consents') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      }),
    } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);
  });

  const validFormInput = {
    businessName: 'Panadería La Espiga',
    phone: '3815550123',
    defaultPickupAddress: 'San Martín 450',
    defaultPickupZoneId: '11111111-1111-1111-1111-111111111111',
    defaultPickupLat: -27.43,
    defaultPickupLng: -65.61,
    notes: 'Al lado de la plaza',
    acceptPilotTerms: true,
    pilotTermsVersion: '1.0',
  };

  it('rechaza si no hay sesión autenticada con UNAUTHENTICATED', async () => {
    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);

    const result = await merchantOnboardingAction(validFormInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('UNAUTHENTICATED');
    }
  });

  it('rechaza si el usuario no tiene rol merchant con UNAUTHORIZED_ACTOR', async () => {
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: 'courier' }, // No es merchant
            error: null,
          }),
        };
      }
      return {};
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-courier-1', email: 'courier@test.com' } },
          error: null,
        }),
      },
      from: mockFrom,
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);

    const result = await merchantOnboardingAction(validFormInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('UNAUTHORIZED_ACTOR');
    }
  });

  it('rechaza datos inválidos (coordenadas fuera de Aguilares) con VALIDATION_ERROR', async () => {
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: 'merchant' },
            error: null,
          }),
        };
      }
      return {};
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-merchant-1', email: 'comercio@test.com' } },
          error: null,
        }),
      },
      from: mockFrom,
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);

    const invalidCoordsInput = {
      ...validFormInput,
      defaultPickupLat: -34.6, // Buenos Aires
      defaultPickupLng: -58.38,
    };

    const result = await merchantOnboardingAction(invalidCoordsInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('VALIDATION_ERROR');
    }
  });

  it('alta exitosa: el comercio queda en pilot, se guarda versión de consentimiento y actualiza perfil', async () => {
    let insertedMerchant: unknown = null;
    let insertedConsent: unknown = null;
    let upsertOptions: unknown = null;
    let updatedProfile: unknown = null;

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: 'merchant' },
            error: null,
          }),
          update: vi.fn().mockImplementation((payload) => {
            updatedProfile = payload;
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }
      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { key: 'pilot_terms_version', value: '1.0' },
            error: null,
          }),
        };
      }
      if (table === 'consents') {
        return {
          insert: vi.fn().mockImplementation((payload) => {
            insertedConsent = payload;
            return Promise.resolve({ error: null });
          }),
          upsert: vi.fn().mockImplementation((payload, options) => {
            insertedConsent = payload;
            upsertOptions = options;
            return Promise.resolve({ error: null });
          }),
        };
      }
      if (table === 'merchants') {
        return {
          upsert: vi.fn().mockImplementation((payload) => {
            insertedMerchant = payload;
            return Promise.resolve({ error: null });
          }),
          insert: vi.fn().mockImplementation((payload) => {
            insertedMerchant = payload;
            return Promise.resolve({ error: null });
          }),
        };
      }
      return {};
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-merchant-1', email: 'comercio@test.com' } },
          error: null,
        }),
      },
      from: mockFrom,
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);
    vi.mocked(adminSupabase.createAdminClient).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

    const result = await merchantOnboardingAction(validFormInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.redirectTo).toBe('/merchant/dashboard');
    }

    // Verificación 1: el comercio queda en subscription_status = 'pilot'
    expect(insertedMerchant).toMatchObject({
      profile_id: 'usr-merchant-1',
      business_name: 'Panadería La Espiga',
      subscription_status: 'pilot',
      paid_until: null,
      default_pickup_address: 'San Martín 450',
      default_pickup_lat: -27.43,
      default_pickup_lng: -65.61,
      default_pickup_zone_id: '11111111-1111-1111-1111-111111111111',
      notes: 'Al lado de la plaza',
    });

    // Verificación 2: versión de consentimiento guardada en consents mediante upsert idempotente
    expect(insertedConsent).toMatchObject({
      profile_id: 'usr-merchant-1',
      document: 'pilot_terms',
      version: '1.0',
    });
    expect(upsertOptions).toEqual({
      onConflict: 'profile_id,document,version',
      ignoreDuplicates: true,
    });

    // Verificación 3: perfil actualizado con display_name y phone
    expect(updatedProfile).toMatchObject({
      display_name: 'Panadería La Espiga',
      phone: '3815550123',
    });
  });

  it('mapea errores de base de datos a DomainErrorCode', async () => {
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: 'merchant' },
            error: null,
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { value: '1.0' },
            error: null,
          }),
        };
      }
      if (table === 'consents') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'merchants') {
        return {
          upsert: vi.fn().mockResolvedValue({
            error: { message: 'Database error', code: '500' },
          }),
          insert: vi.fn().mockResolvedValue({
            error: { message: 'Database error', code: '500' },
          }),
        };
      }
      return {};
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-merchant-1', email: 'comercio@test.com' } },
          error: null,
        }),
      },
      from: mockFrom,
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);

    vi.mocked(adminSupabase.createAdminClient).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

    const result = await merchantOnboardingAction(validFormInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INTERNAL_ERROR');
    }
  });

  it('devuelve INTERNAL_ERROR si la inserción de consentimientos falla en adminClient (H08)', async () => {
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: 'merchant' },
            error: null,
          }),
        };
      }
      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { value: '1.0' },
            error: null,
          }),
        };
      }
      return {};
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-merchant-1', email: 'comercio@test.com' } },
          error: null,
        }),
      },
      from: mockFrom,
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);

    vi.mocked(adminSupabase.createAdminClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'consents') {
          return {
            insert: vi.fn().mockResolvedValue({ error: { message: 'Insert consent error' } }),
            upsert: vi.fn().mockResolvedValue({ error: { message: 'Upsert consent error' } }),
          };
        }
        return {};
      }),
    } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

    const result = await merchantOnboardingAction(validFormInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INTERNAL_ERROR');
    }
  });

  it('falla con INTERNAL_ERROR si platform_settings no devuelve versión de pilot_terms o es null (H04)', async () => {
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: 'merchant' },
            error: null,
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        };
      }
      if (table === 'consents') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'merchants') {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-merchant-1', email: 'comercio@test.com' } },
          error: null,
        }),
      },
      from: mockFrom,
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);

    const result = await merchantOnboardingAction(validFormInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INTERNAL_ERROR');
    }
  });

  it('soporta setting legado v1 normalizándolo a 1.0 y persiste exitosamente (H04)', async () => {
    let insertedConsent: unknown = null;
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: 'merchant' },
            error: null,
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { value: 'v1' },
            error: null,
          }),
        };
      }
      if (table === 'consents') {
        return {
          insert: vi.fn().mockImplementation((payload) => {
            insertedConsent = payload;
            return Promise.resolve({ error: null });
          }),
          upsert: vi.fn().mockImplementation((payload) => {
            insertedConsent = payload;
            return Promise.resolve({ error: null });
          }),
        };
      }
      if (table === 'merchants') {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-merchant-1', email: 'comercio@test.com' } },
          error: null,
        }),
      },
      from: mockFrom,
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);
    vi.mocked(adminSupabase.createAdminClient).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

    const result = await merchantOnboardingAction(validFormInput);
    expect(result.ok).toBe(true);
    expect(insertedConsent).toMatchObject({
      document: 'pilot_terms',
      version: '1.0',
    });
  });

  it('falla con INTERNAL_ERROR sin escribir consent ni merchant si el setting tiene una versión futura no publicada (H04)', async () => {
    const insertConsentSpy = vi.fn();
    const upsertMerchantSpy = vi.fn();

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: 'merchant' },
            error: null,
          }),
        };
      }
      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { value: '2.0' }, // Futura versión sin documento publicado en el registro
            error: null,
          }),
        };
      }
      if (table === 'consents') {
        return {
          insert: insertConsentSpy,
          upsert: insertConsentSpy,
        };
      }
      if (table === 'merchants') {
        return {
          upsert: upsertMerchantSpy,
          insert: upsertMerchantSpy,
        };
      }
      return {};
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-merchant-1', email: 'comercio@test.com' } },
          error: null,
        }),
      },
      from: mockFrom,
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);
    vi.mocked(adminSupabase.createAdminClient).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

    const result = await merchantOnboardingAction({
      ...validFormInput,
      pilotTermsVersion: '2.0',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INTERNAL_ERROR');
    }
    expect(insertConsentSpy).not.toHaveBeenCalled();
    expect(upsertMerchantSpy).not.toHaveBeenCalled();
  });

  it('rechaza con VALIDATION_ERROR sin escribir consent ni merchant si el input tiene versión desactualizada 0.9 (H05)', async () => {
    const insertConsentSpy = vi.fn();
    const upsertMerchantSpy = vi.fn();

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: 'merchant' },
            error: null,
          }),
        };
      }
      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { value: '1.0' },
            error: null,
          }),
        };
      }
      if (table === 'consents') {
        return {
          insert: insertConsentSpy,
          upsert: insertConsentSpy,
        };
      }
      if (table === 'merchants') {
        return {
          upsert: upsertMerchantSpy,
          insert: upsertMerchantSpy,
        };
      }
      return {};
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-merchant-1', email: 'comercio@test.com' } },
          error: null,
        }),
      },
      from: mockFrom,
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);
    vi.mocked(adminSupabase.createAdminClient).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

    const result = await merchantOnboardingAction({
      ...validFormInput,
      pilotTermsVersion: '0.9',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('VALIDATION_ERROR');
    }
    expect(insertConsentSpy).not.toHaveBeenCalled();
    expect(upsertMerchantSpy).not.toHaveBeenCalled();
  });

  it('reintento merchant después de fallo posterior: no falla aunque pilot_terms ya exista y no reescribe accepted_at (H13)', async () => {
    let upsertCalledWithOptions: unknown = null;

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: 'merchant' },
            error: null,
          }),
          update: vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }
      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { key: 'pilot_terms_version', value: '1.0' },
            error: null,
          }),
        };
      }
      if (table === 'consents') {
        return {
          upsert: vi.fn().mockImplementation((_payload, options) => {
            upsertCalledWithOptions = options;
            return Promise.resolve({ data: null, error: null });
          }),
        };
      }
      if (table === 'merchants') {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-merchant-1', email: 'comercio@test.com' } },
          error: null,
        }),
      },
      from: mockFrom,
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);
    vi.mocked(adminSupabase.createAdminClient).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

    const result = await merchantOnboardingAction(validFormInput);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.redirectTo).toBe('/merchant/dashboard');
    }
    expect(upsertCalledWithOptions).toEqual({
      onConflict: 'profile_id,document,version',
      ignoreDuplicates: true,
    });
  });

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
            // ignoreDuplicates: true -> conserva fila existente intacta sin reescribir accepted_at
            continue;
          }
          store.set(key, { ...row, accepted_at: new Date().toISOString() });
        }
        return { data: rows, error: null };
      }),
    };

    return { store, queryBuilder };
  }

  it('reintento merchant con consentimientos preexistentes: no falla por duplicado y preserva accepted_at original (H13/H14)', async () => {
    const originalAcceptedAt = '2026-09-01T12:00:00.000Z';
    const fakeConsents = createConsentsStatefulFake([
      {
        profile_id: 'usr-merchant-1',
        document: 'pilot_terms',
        version: '1.0',
        accepted_at: originalAcceptedAt,
      },
    ]);

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { role: 'merchant' },
            error: null,
          }),
          update: vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }
      if (table === 'platform_settings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { key: 'pilot_terms_version', value: '1.0' },
            error: null,
          }),
        };
      }
      if (table === 'consents') {
        return fakeConsents.queryBuilder;
      }
      if (table === 'merchants') {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-merchant-1', email: 'comercio@test.com' } },
          error: null,
        }),
      },
      from: mockFrom,
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);
    vi.mocked(adminSupabase.createAdminClient).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

    const result = await merchantOnboardingAction(validFormInput);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.redirectTo).toBe('/merchant/dashboard');
    }
    // Verifica que el consentimiento preexistente NO fue sobreescrito (conserva su accepted_at original)
    const storedRow = fakeConsents.store.get('usr-merchant-1:pilot_terms:1.0');
    expect(storedRow).toBeDefined();
    expect(storedRow?.accepted_at).toBe(originalAcceptedAt);
  });
});
