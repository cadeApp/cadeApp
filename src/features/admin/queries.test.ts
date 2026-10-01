import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import * as adminSupabase from '@/server/supabase/admin';
import {
  getApplicantsQueue,
  getApplicantDetail,
  getAdminMerchants,
  getAuditActors,
  getAuditLog,
  getPlatformSettings,
  getRecentSettingChanges,
} from './queries';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/server/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

describe('Admin Queries (T-122 DoD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PR106-H07 y PR106-H12: Cola de postulantes (getApplicantsQueue)', () => {
    it('utiliza await createClient() (sesión autenticada) y NO createAdminClient() (PR106-H12)', async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: mockLimit,
              }),
            }),
          }),
        }),
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      await getApplicantsQueue('pending');

      expect(serverSupabase.createClient).toHaveBeenCalled();
      expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
    });

    it('primera página usa limit(pageSize + 1) y NO llama a range() (PR106-H07)', async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: [
          {
            profile_id: 'courier-1',
            status: 'pending',
            vehicle_type: 'moto',
            vehicle_plate: 'A123BCD',
            dni_hmac: 'abcdef123456',
            doc_level: 1,
            license_status: 'submitted',
            insurance_status: 'none',
            profiles: {
              display_name: 'Juan Perez',
              phone: '3865123456',
              created_at: '2026-09-25T10:00:00Z',
            },
            courier_documents: [
              { kind: 'dni_front', status: 'submitted' },
              { kind: 'dni_back', status: 'submitted' },
              { kind: 'selfie', status: 'submitted' },
            ],
          },
        ],
        error: null,
      });
      const mockRange = vi.fn();

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: mockLimit,
                range: mockRange,
              }),
            }),
          }),
        }),
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const result = await getApplicantsQueue('pending', { pageSize: 20 });
      expect(mockLimit).toHaveBeenCalledWith(21);
      expect(mockRange).not.toHaveBeenCalled();
      expect(result.pageSize).toBe(20);
      expect(result.hasNextPage).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.fullName).toBe('Juan Perez');
      expect(result.items[0]?.documentsSummary.hasDniFront).toBe(true);
      expect(result.items[0]?.documentsSummary.hasLicense).toBe(false);
    });

    it('con cursor válido aplica filtro .lt("profile_id", cursor) (PR106-H07)', async () => {
      const mockLimit = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      const mockLt = vi.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                lt: mockLt,
              }),
            }),
          }),
        }),
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const cursorUuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      await getApplicantsQueue('pending', { cursor: cursorUuid, pageSize: 20 });

      expect(mockLt).toHaveBeenCalledWith('profile_id', cursorUuid);
      expect(mockLimit).toHaveBeenCalledWith(21);
    });

    it('calcula hasNextPage y nextCursor a partir del último item visible ante fila extra (PR106-H07)', async () => {
      // Pedimos pageSize=2 -> limit(3) -> data devuelve 3 filas -> hasNextPage=true, nextCursor='c-2'
      const mockLimit = vi.fn().mockResolvedValue({
        data: [
          {
            profile_id: 'c-1',
            status: 'pending',
            profiles: null,
            courier_documents: [],
          },
          {
            profile_id: 'c-2',
            status: 'pending',
            profiles: null,
            courier_documents: [],
          },
          {
            profile_id: 'c-3',
            status: 'pending',
            profiles: null,
            courier_documents: [],
          },
        ],
        error: null,
      });

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: mockLimit,
              }),
            }),
          }),
        }),
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const result = await getApplicantsQueue('pending', { pageSize: 2 });
      expect(mockLimit).toHaveBeenCalledWith(3);
      expect(result.hasNextPage).toBe(true);
      expect(result.nextCursor).toBe('c-2');
      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.id).toBe('c-1');
      expect(result.items[1]?.id).toBe('c-2');
    });

    it('propaga y lanza excepción ante error de DB en getApplicantsQueue (PR106-H08)', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database connection failed' },
                }),
              }),
            }),
          }),
        }),
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      await expect(getApplicantsQueue('pending')).rejects.toThrow('Database connection failed');
    });
  });

  describe('PR106-H12: Detalle de postulante (getApplicantDetail)', () => {
    it('utiliza await createClient() (sesión autenticada) y NO createAdminClient() (PR106-H12)', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'couriers') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      profile_id: 'courier-1',
                      status: 'pending',
                      vehicle_type: 'moto',
                      vehicle_plate: 'A123BCD',
                      dni_hmac: 'abcdef123456',
                      doc_level: 1,
                      license_status: 'submitted',
                      insurance_status: 'none',
                      decided_at: null,
                      decided_by: null,
                      deactivated_at: null,
                      profiles: {
                        display_name: 'Juan Perez',
                        phone: '3865123456',
                        created_at: '2026-09-25T10:00:00Z',
                      },
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'courier_documents') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      await getApplicantDetail('courier-1');

      expect(serverSupabase.createClient).toHaveBeenCalled();
      expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
    });

    it('INVARIANTE CRÍTICO: CBU / Alias bancario extirpado y jamás expuesto en el objeto', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'couriers') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      profile_id: 'courier-1',
                      status: 'pending',
                      vehicle_type: 'moto',
                      vehicle_plate: 'A123BCD',
                      dni_hmac: 'abcdef123456',
                      doc_level: 1,
                      license_status: 'submitted',
                      insurance_status: 'none',
                      decided_at: null,
                      decided_by: null,
                      deactivated_at: null,
                      profiles: {
                        display_name: 'Juan Perez',
                        phone: '3865123456',
                        created_at: '2026-09-25T10:00:00Z',
                      },
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'courier_documents') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: 'doc-1',
                        kind: 'dni_front',
                        storage_path: 'courier-1/dni_front.webp',
                        status: 'submitted',
                        uploaded_at: '2026-09-25T10:05:00Z',
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const detail = await getApplicantDetail('courier-1');
      expect(detail).not.toBeNull();
      if (detail) {
        const keys = Object.keys(detail);
        const forbiddenFields = ['cbu', 'alias', 'bank_account', 'bank', 'cbu_alias'];
        for (const field of forbiddenFields) {
          expect(keys).not.toContain(field);
        }
        expect(detail.id).toBe('courier-1');
        expect(detail.documents).toHaveLength(1);
        expect(detail.documents[0]?.documentType).toBe('dni_front');
      }
    });

    it('retorna null si el repartidor no existe', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'couriers') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          };
        }),
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const detail = await getApplicantDetail('inexistente');
      expect(detail).toBeNull();
    });

    it('propaga y lanza excepción ante error de DB en getApplicantDetail (PR106-H08)', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'couriers') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'DB connection timeout' },
                  }),
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          };
        }),
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      await expect(getApplicantDetail('courier-1')).rejects.toThrow('DB connection timeout');
    });
  });
});

// T-123: A03/A04/A06
type ServerClient = Awaited<ReturnType<typeof serverSupabase.createClient>>;

interface RecordedCall {
  readonly table: string;
  readonly method: string;
  readonly args: readonly unknown[];
}

const CHAIN_METHODS = [
  'select',
  'eq',
  'neq',
  'lt',
  'gt',
  'lte',
  'gte',
  'in',
  'is',
  'or',
  'filter',
  'match',
  'order',
  'limit',
  'range',
  'maybeSingle',
  'single',
] as const;

/**
 * Cliente simulado que registra cada llamada del query builder sin fijar su orden.
 */
function mockClient(resultsByTable: Record<string, { data: unknown; error: unknown }>) {
  const calls: RecordedCall[] = [];
  const from = vi.fn((table: string) => {
    const result = resultsByTable[table] ?? { data: [], error: null };
    const builder: Record<string, unknown> = {
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    };
    for (const method of CHAIN_METHODS) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return builder;
      };
    }
    return builder;
  });
  const client = { from, rpc: vi.fn() };
  vi.mocked(serverSupabase.createClient).mockResolvedValue(client as unknown as ServerClient);
  return { client, calls };
}

function callsOf(calls: readonly RecordedCall[], table: string, method: string) {
  return calls.filter((call) => call.table === table && call.method === method);
}

const MERCHANT_A = 'f0000000-0000-4000-8000-00000000000a';
const MERCHANT_B = 'f0000000-0000-4000-8000-00000000000b';

function merchantRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    profile_id: id,
    business_name: 'Panadería La Espiga',
    subscription_status: 'active',
    paid_until: '2026-10-31',
    profiles: { display_name: 'Rosa Díaz', phone: '3865551234' },
    zones: { name: 'Centro' },
    delivery_requests: [{ count: 42 }],
    ...overrides,
  };
}

describe('T-123: getAdminMerchants (A03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lee con el cliente de sesión (RLS) y nunca con service role', async () => {
    mockClient({ merchants: { data: [], error: null } });
    await getAdminMerchants();
    expect(serverSupabase.createClient).toHaveBeenCalled();
    expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
  });

  it('no selecciona CUIT y cuenta despachos entregados', async () => {
    const { calls } = mockClient({ merchants: { data: [], error: null } });
    await getAdminMerchants();

    const [select] = callsOf(calls, 'merchants', 'select');
    expect(select).toBeDefined();
    const columns = String(select?.args[0]);
    expect(columns).not.toMatch(/cuit/i);
    expect(columns).toMatch(/delivery_requests\s*\(\s*count\s*\)/);
    expect(callsOf(calls, 'merchants', 'eq')).toContainEqual(
      expect.objectContaining({ args: ['delivery_requests.status', 'delivered'] })
    );
  });

  it('pagina server-side por cursor: limit(pageSize + 1), sin range()', async () => {
    const { calls } = mockClient({ merchants: { data: [], error: null } });
    await getAdminMerchants({ pageSize: 10 });

    expect(callsOf(calls, 'merchants', 'order')[0]?.args).toEqual([
      'profile_id',
      { ascending: false },
    ]);
    expect(callsOf(calls, 'merchants', 'limit')[0]?.args).toEqual([11]);
    expect(callsOf(calls, 'merchants', 'range')).toHaveLength(0);
    expect(callsOf(calls, 'merchants', 'lt')).toHaveLength(0);
  });

  it('aplica el cursor con lt(profile_id)', async () => {
    const { calls } = mockClient({ merchants: { data: [], error: null } });
    await getAdminMerchants({ cursor: MERCHANT_B });
    expect(callsOf(calls, 'merchants', 'lt')[0]?.args).toEqual(['profile_id', MERCHANT_B]);
  });

  it('acota el tamaño de página a 50 y usa 20 por defecto', async () => {
    const first = mockClient({ merchants: { data: [], error: null } });
    await getAdminMerchants({ pageSize: 500 });
    expect(callsOf(first.calls, 'merchants', 'limit')[0]?.args).toEqual([51]);

    const second = mockClient({ merchants: { data: [], error: null } });
    await getAdminMerchants();
    expect(callsOf(second.calls, 'merchants', 'limit')[0]?.args).toEqual([21]);
  });

  it('mapea filas a items sin CUIT y calcula nextCursor', async () => {
    mockClient({
      merchants: {
        data: [merchantRow(MERCHANT_B), merchantRow(MERCHANT_A, { cuit: '20-12345678-9' })],
        error: null,
      },
    });

    const result = await getAdminMerchants({ pageSize: 1 });

    expect(result.items).toEqual([
      {
        id: MERCHANT_B,
        businessName: 'Panadería La Espiga',
        ownerName: 'Rosa Díaz',
        phone: '3865551234',
        pickupZoneName: 'Centro',
        subscriptionStatus: 'active',
        paidUntil: '2026-10-31',
        deliveredCount: 42,
      },
    ]);
    expect(result.hasNextPage).toBe(true);
    expect(result.nextCursor).toBe(MERCHANT_B);
    expect(JSON.stringify(result)).not.toMatch(/cuit|20-12345678-9/i);
  });

  it('propaga el error de base para el error boundary', async () => {
    mockClient({ merchants: { data: null, error: { message: 'boom' } } });
    await expect(getAdminMerchants()).rejects.toThrow();
  });
});

describe('T-123: getPlatformSettings (A04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const rows = [
    { key: 'min_offer_ars', value: 1500 },
    { key: 'request_ttl_minutes', value: 45 },
    { key: 'pilot_active', value: false },
    { key: 'pilot_terms_version', value: '1.1' },
    { key: 'subscription_grace_days', value: 3 },
  ];

  it('devuelve los valores vigentes de platform_settings, no constantes', async () => {
    mockClient({ platform_settings: { data: rows, error: null } });
    await expect(getPlatformSettings()).resolves.toEqual({
      minOfferArs: 1500,
      requestTtlMinutes: 45,
      pilotActive: false,
      pilotTermsVersion: '1.1',
      subscriptionGraceDays: 3,
    });
    expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
  });

  it('si falta el piso no inventa 1000: falla', async () => {
    mockClient({
      platform_settings: { data: rows.filter((row) => row.key !== 'min_offer_ars'), error: null },
    });
    await expect(getPlatformSettings()).rejects.toThrow();
  });

  it('valida el tipo de cada valor con Zod', async () => {
    mockClient({
      platform_settings: {
        data: rows.map((row) => (row.key === 'pilot_active' ? { ...row, value: 'yes' } : row)),
        error: null,
      },
    });
    await expect(getPlatformSettings()).rejects.toThrow();
  });
});

const AUDIT_ROWS = [
  {
    id: 90,
    created_at: '2026-09-27T12:00:00.000Z',
    actor_id: 'a0000000-0000-4000-8000-000000000001',
    action: 'admin_set_subscription',
    target_type: 'merchant',
    target_id: MERCHANT_A,
    before: { subscription_status: 'pilot', paid_until: null },
    after: {
      subscription_status: 'active',
      paid_until: '2026-10-31',
      notes: 'Pagó Juan Pérez, tel 3865 44-1122',
    },
    profiles: { display_name: 'Lautaro' },
  },
  {
    id: 89,
    created_at: '2026-09-27T11:00:00.000Z',
    actor_id: 'a0000000-0000-4000-8000-000000000001',
    action: 'admin_decide_courier',
    target_type: 'courier',
    target_id: 'b0000000-0000-4000-8000-000000000002',
    before: { status: 'pending' },
    after: { status: 'rejected', reason: 'DNI 30111222 ilegible' },
    profiles: { display_name: 'Lautaro' },
  },
  {
    id: 88,
    created_at: '2026-09-27T10:00:00.000Z',
    actor_id: null,
    action: 'admin_update_setting',
    target_type: 'platform_setting',
    target_id: 'min_offer_ars',
    before: { value: 1000 },
    after: { value: 1500 },
    profiles: null,
  },
];

describe('T-123: getAuditLog (A06, append-only y paginada server-side)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lee audit_log con el cliente de sesión y nunca con service role', async () => {
    mockClient({ audit_log: { data: [], error: null } });
    await getAuditLog();
    expect(serverSupabase.createClient).toHaveBeenCalled();
    expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
  });

  it('pagina por cursor de id descendente con limit(pageSize + 1) y sin range()', async () => {
    const { calls } = mockClient({ audit_log: { data: [], error: null } });
    await getAuditLog({ pageSize: 25 });

    expect(callsOf(calls, 'audit_log', 'order')[0]?.args).toEqual(['id', { ascending: false }]);
    expect(callsOf(calls, 'audit_log', 'limit')[0]?.args).toEqual([26]);
    expect(callsOf(calls, 'audit_log', 'range')).toHaveLength(0);
  });

  it('aplica el cursor con lt(id)', async () => {
    const { calls } = mockClient({ audit_log: { data: [], error: null } });
    await getAuditLog({ cursor: 89 });
    expect(callsOf(calls, 'audit_log', 'lt')[0]?.args).toEqual(['id', 89]);
  });

  it('acota a 50 filas por página aunque se pidan más', async () => {
    const { calls } = mockClient({ audit_log: { data: [], error: null } });
    await getAuditLog({ pageSize: 10_000 });
    expect(callsOf(calls, 'audit_log', 'limit')[0]?.args).toEqual([51]);
  });

  it('filtra por operador, tipo de evento y entidad en la base', async () => {
    const { calls } = mockClient({ audit_log: { data: [], error: null } });
    await getAuditLog({
      actorId: 'a0000000-0000-4000-8000-000000000001',
      action: 'admin_update_setting',
      targetType: 'platform_setting',
    });

    const eqArgs = callsOf(calls, 'audit_log', 'eq').map((call) => call.args);
    expect(eqArgs).toContainEqual(['actor_id', 'a0000000-0000-4000-8000-000000000001']);
    expect(eqArgs).toContainEqual(['action', 'admin_update_setting']);
    expect(eqArgs).toContainEqual(['target_type', 'platform_setting']);
  });

  it('no selecciona columnas de contacto ni PII del operador', async () => {
    const { calls } = mockClient({ audit_log: { data: [], error: null } });
    await getAuditLog();
    const columns = String(callsOf(calls, 'audit_log', 'select')[0]?.args[0]);
    expect(columns).not.toMatch(/phone|email|dni/i);
  });

  it('devuelve nextCursor y el detalle saneado sin motivos ni notas libres', async () => {
    mockClient({ audit_log: { data: AUDIT_ROWS, error: null } });

    const result = await getAuditLog({ pageSize: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.hasNextPage).toBe(true);
    expect(result.nextCursor).toBe(89);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('Juan Pérez');
    expect(serialized).not.toContain('3865 44-1122');
    expect(serialized).not.toContain('30111222');

    const [subscription, decision] = result.items;
    expect(subscription).toMatchObject({
      id: 90,
      actorName: 'Lautaro',
      action: 'admin_set_subscription',
      targetType: 'merchant',
      hasReason: false,
    });
    expect(subscription?.changes).toEqual(
      expect.arrayContaining([
        { field: 'subscription_status', before: 'pilot', after: 'active' },
        { field: 'paid_until', before: null, after: '2026-10-31' },
      ])
    );
    expect(decision).toMatchObject({ hasReason: true });
    expect(decision?.changes).toEqual([{ field: 'status', before: 'pending', after: 'rejected' }]);
  });

  it('un evento sin operador (sistema) queda con actorName null', async () => {
    mockClient({ audit_log: { data: [AUDIT_ROWS[2]], error: null } });
    const result = await getAuditLog();
    expect(result.items[0]).toMatchObject({
      actorName: null,
      targetRef: 'min_offer_ars',
      changes: [{ field: 'value', before: 1000, after: 1500 }],
    });
  });

  it('propaga el error de base para el error boundary', async () => {
    mockClient({ audit_log: { data: null, error: { message: 'boom' } } });
    await expect(getAuditLog()).rejects.toThrow();
  });
});

describe('T-123: getRecentSettingChanges (A04, panel «Últimos cambios»)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('trae los últimos 5 cambios de platform_setting desde audit_log', async () => {
    const { calls } = mockClient({ audit_log: { data: [AUDIT_ROWS[2]], error: null } });

    const items = await getRecentSettingChanges();

    expect(callsOf(calls, 'audit_log', 'eq').map((call) => call.args)).toContainEqual([
      'target_type',
      'platform_setting',
    ]);
    expect(callsOf(calls, 'audit_log', 'order')[0]?.args).toEqual(['id', { ascending: false }]);
    expect(callsOf(calls, 'audit_log', 'limit')[0]?.args).toEqual([5]);
    expect(items).toHaveLength(1);
  });
});

describe('T-123: getAuditActors (A06, filtro por operador)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista solo admins, con id y nombre, acotado', async () => {
    const { calls } = mockClient({
      profiles: {
        data: [{ id: 'a0000000-0000-4000-8000-000000000001', display_name: 'Lautaro' }],
        error: null,
      },
    });

    const actors = await getAuditActors();

    expect(actors).toEqual([{ id: 'a0000000-0000-4000-8000-000000000001', name: 'Lautaro' }]);
    expect(callsOf(calls, 'profiles', 'eq').map((call) => call.args)).toContainEqual([
      'role',
      'admin',
    ]);
    const columns = String(callsOf(calls, 'profiles', 'select')[0]?.args[0]);
    expect(columns).not.toMatch(/phone|email/i);
    const limit = callsOf(calls, 'profiles', 'limit')[0]?.args[0];
    expect(typeof limit === 'number' && limit <= 50).toBe(true);
  });
});

describe('T-321: Desambiguación de embeds PostgREST con foreign keys canónicas (DoD T-321)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getApplicantsQueue usa profiles!couriers_profile_id_fkey y no profiles:profile_id', async () => {
    const { calls } = mockClient({ couriers: { data: [], error: null } });
    await getApplicantsQueue('pending');

    const [select] = callsOf(calls, 'couriers', 'select');
    expect(select).toBeDefined();
    const selectStr = String(select?.args[0]);
    expect(selectStr).toMatch(/profiles!couriers_profile_id_fkey\s*\(/);
    expect(selectStr).not.toMatch(/profiles:profile_id/);
  });

  it('getApplicantDetail usa profiles!couriers_profile_id_fkey y no profiles:profile_id', async () => {
    const { calls } = mockClient({
      couriers: { data: null, error: null },
      courier_documents: { data: [], error: null },
    });
    await getApplicantDetail('c-1');

    const [select] = callsOf(calls, 'couriers', 'select');
    expect(select).toBeDefined();
    const selectStr = String(select?.args[0]);
    expect(selectStr).toMatch(/profiles!couriers_profile_id_fkey\s*\(/);
    expect(selectStr).not.toMatch(/profiles:profile_id/);
  });

  it('getAdminMerchants usa profiles!merchants_profile_id_fkey y no profiles:profile_id', async () => {
    const { calls } = mockClient({ merchants: { data: [], error: null } });
    await getAdminMerchants();

    const [select] = callsOf(calls, 'merchants', 'select');
    expect(select).toBeDefined();
    const selectStr = String(select?.args[0]);
    expect(selectStr).toMatch(/profiles!merchants_profile_id_fkey\s*\(/);
    expect(selectStr).not.toMatch(/profiles:profile_id/);
  });

  it('getAuditLog usa profiles!audit_log_actor_id_fkey y no profiles:actor_id', async () => {
    const { calls } = mockClient({ audit_log: { data: [], error: null } });
    await getAuditLog();

    const [select] = callsOf(calls, 'audit_log', 'select');
    expect(select).toBeDefined();
    const selectStr = String(select?.args[0]);
    expect(selectStr).toMatch(/profiles!audit_log_actor_id_fkey\s*\(/);
    expect(selectStr).not.toMatch(/profiles:actor_id/);
  });

  it('getRecentSettingChanges usa profiles!audit_log_actor_id_fkey y no profiles:actor_id', async () => {
    const { calls } = mockClient({ audit_log: { data: [], error: null } });
    await getRecentSettingChanges();

    const [select] = callsOf(calls, 'audit_log', 'select');
    expect(select).toBeDefined();
    const selectStr = String(select?.args[0]);
    expect(selectStr).toMatch(/profiles!audit_log_actor_id_fkey\s*\(/);
    expect(selectStr).not.toMatch(/profiles:actor_id/);
  });
});

