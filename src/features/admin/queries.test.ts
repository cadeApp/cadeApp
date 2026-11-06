import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import * as adminSupabase from '@/server/supabase/admin';
import {
  getApplicantsQueue,
  getApplicantDetail,
  getAdminMerchants,
  getAdminOperatorName,
  getAdminMerchantHeader,
  getAuditActors,
  getAuditLog,
  getPlatformSettings,
  getRecentSettingChanges,
  getPublicationPlans,
  getAdminMerchantPublicationCredits,
  parsePublicationPlansParams,
} from './queries';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/server/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

/** T-404: consentimientos y auditoría vacíos para los mocks del detalle que no los miran. */
function emptyTable() {
  const builder: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
  };
  for (const method of ['select', 'eq', 'or', 'order', 'limit']) builder[method] = () => builder;
  return builder;
}

describe('Admin Queries (T-122 DoD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('T-403 / CC-044: Cola de postulantes (getApplicantsQueue) sobre admin_list_applicants', () => {
    const COURIER_1 = 'c0000000-0000-4000-8000-000000000001';
    const COURIER_2 = 'c0000000-0000-4000-8000-000000000002';

    function rpcItem(id: string, overrides: Record<string, unknown> = {}) {
      return {
        id,
        displayName: 'José Pérez',
        phone: '3865123456',
        vehicleType: 'moto',
        status: 'pending',
        hasDni: true,
        docLevel: 1,
        licenseStatus: 'verified',
        insuranceStatus: 'submitted',
        createdAt: '2026-11-03T16:00:00.000000Z',
        submittedAt: '2026-11-03T18:00:00.000000Z',
        documents: { dniFront: true, dniBack: true, selfie: true, license: true, insurance: false },
        ...overrides,
      };
    }

    function page(overrides: Record<string, unknown> = {}) {
      return { items: [rpcItem(COURIER_1)], total: 7, nextCursor: null, prevCursor: null, ...overrides };
    }

    it('usa la sesión del admin (createClient) y nunca createAdminClient (PR106-H12)', async () => {
      mockClient({}, { data: page(), error: null });
      await getApplicantsQueue('pending');
      expect(serverSupabase.createClient).toHaveBeenCalled();
      expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
    });

    it('la búsqueda, el estado, el cursor y la dirección llegan a la RPC; no lee couriers por PostgREST', async () => {
      const { client, calls } = mockClient({}, { data: page(), error: null });
      const cursor = `2026-11-03T16:22:06.662075+00:00~${COURIER_2}`;

      await getApplicantsQueue('approved', { cursor, direction: 'prev', query: 'jose', pageSize: 20 });

      expect(client.rpc).toHaveBeenCalledTimes(1);
      expect(client.rpc).toHaveBeenCalledWith('admin_list_applicants', {
        p_status: 'approved',
        p_query: 'jose',
        p_cursor_created_at: '2026-11-03T16:22:06.662075+00:00',
        p_cursor_id: COURIER_2,
        p_direction: 'prev',
        p_limit: 20,
      });
      // T-403: la búsqueda se resuelve en la base (CC-044); el cliente no filtra ni consulta couriers.
      expect(calls).toEqual([]);
    });

    it('sin búsqueda ni cursor pide la primera página hacia adelante', async () => {
      const { client } = mockClient({}, { data: page(), error: null });
      await getApplicantsQueue('pending');
      expect(client.rpc).toHaveBeenCalledWith('admin_list_applicants', {
        p_status: 'pending',
        p_query: null,
        p_cursor_created_at: null,
        p_cursor_id: null,
        p_direction: 'next',
        p_limit: 20,
      });
    });

    it('devuelve el total, los ítems con «Enviado» y los dos cursores «fecha~id»', async () => {
      mockClient(
        {},
        {
          data: page({
            items: [rpcItem(COURIER_1), rpcItem(COURIER_2, { submittedAt: null, vehicleType: null })],
            nextCursor: { createdAt: '2026-11-03T15:00:00.000000Z', id: COURIER_2 },
            prevCursor: { createdAt: '2026-11-03T16:00:00.000000Z', id: COURIER_1 },
          }),
          error: null,
        }
      );

      const result = await getApplicantsQueue('pending', { pageSize: 2 });

      expect(result.total).toBe(7);
      expect(result.pageSize).toBe(2);
      expect(result.nextCursor).toBe(`2026-11-03T15:00:00.000000Z~${COURIER_2}`);
      expect(result.prevCursor).toBe(`2026-11-03T16:00:00.000000Z~${COURIER_1}`);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPrevPage).toBe(true);
      expect(result.items[0]).toMatchObject({
        id: COURIER_1,
        fullName: 'José Pérez',
        submittedAt: '2026-11-03T18:00:00.000000Z',
        licenseStatus: 'verified',
        insuranceStatus: 'submitted',
        documentsSummary: { hasDniFront: true, hasDniBack: true, hasSelfie: true, hasLicense: true, hasInsurance: false },
      });
      expect(result.items[1]).toMatchObject({ submittedAt: null, vehicleType: null });
    });

    it('un error de la RPC se propaga como excepción, solo con el código (PR106-H08)', async () => {
      mockClient({}, { data: null, error: { code: 'P0001', message: 'AAL2_REQUIRED' } });
      await expect(getApplicantsQueue('pending')).rejects.toThrow('AAL2_REQUIRED');
    });

    it('una salida fuera del contrato (por ejemplo con el hash del DNI) no llega a la UI', async () => {
      mockClient({}, { data: page({ items: [rpcItem(COURIER_1, { dniHmac: 'ab'.repeat(32) })] }), error: null });
      await expect(getApplicantsQueue('pending')).rejects.toThrow('INTERNAL_ERROR');
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
          return emptyTable();
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
          return emptyTable();
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

    it('CC-025 / T-356: getApplicantDetail proyecta isCurrent, rejectionCode y ordena vigentes primero', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'couriers') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      profile_id: 'courier-history',
                      status: 'pending',
                      vehicle_type: 'moto',
                      vehicle_plate: 'AB 123 CD',
                      dni_hmac: 'a1b2c3d4e5f6',
                      doc_level: 1,
                      license_status: 'submitted',
                      insurance_status: 'none',
                      decided_at: null,
                      decided_by: null,
                      deactivated_at: null,
                      profiles: {
                        display_name: 'Carlos Revisor',
                        phone: '3865999999',
                        created_at: '2026-10-10T10:00:00Z',
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
                        id: 'doc-old',
                        kind: 'license',
                        storage_path: 'courier-history/license_1.webp',
                        status: 'rejected',
                        uploaded_at: '2026-10-10T10:05:00Z',
                        is_current: false,
                        rejection_code: 'IMAGE_BLURRY',
                      },
                      {
                        id: 'doc-new',
                        kind: 'license',
                        storage_path: 'courier-history/license_2.webp',
                        status: 'submitted',
                        uploaded_at: '2026-10-11T12:00:00Z',
                        is_current: true,
                        rejection_code: null,
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            };
          }
          return emptyTable();
        }),
      };

      vi.mocked(serverSupabase.createClient).mockResolvedValue(
        mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const detail = await getApplicantDetail('courier-history');
      expect(detail).not.toBeNull();
      expect(detail?.documents).toHaveLength(2);

      // El vigente va primero
      expect(detail?.documents[0]?.id).toBe('doc-new');
      expect(detail?.documents[0]?.isCurrent).toBe(true);
      expect(detail?.documents[0]?.status).toBe('submitted');
      expect(detail?.documents[0]?.rejectionCode).toBeNull();

      // El histórico va segundo
      expect(detail?.documents[1]?.id).toBe('doc-old');
      expect(detail?.documents[1]?.isCurrent).toBe(false);
      expect(detail?.documents[1]?.status).toBe('rejected');
      expect(detail?.documents[1]?.rejectionCode).toBe('IMAGE_BLURRY');
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
function mockClient(
  resultsByTable: Record<string, { data: unknown; error: unknown }>,
  rpcResult: { data: unknown; error: unknown } = { data: [], error: null }
) {
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
  const client = { from, rpc: vi.fn().mockResolvedValue(rpcResult) };
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
    profiles: { display_name: 'Rosa Díaz', phone: '3865551234', created_at: '2026-10-01T12:00:00+00:00' },
    zones: { name: 'Centro' },
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

  it('no selecciona CUIT ni embebe delivery_requests (CC-023 cerró su SELECT de tabla, issue 336)', async () => {
    const { calls } = mockClient({ merchants: { data: [], error: null } });
    await getAdminMerchants();

    const [select] = callsOf(calls, 'merchants', 'select');
    expect(select).toBeDefined();
    const columns = String(select?.args[0]);
    expect(columns).not.toMatch(/cuit/i);
    expect(columns).not.toMatch(/delivery_requests|count/i);
    expect(
      calls.filter((call) => call.args.some((arg) => String(arg).includes('delivery_requests')))
    ).toHaveLength(0);
    expect(calls.filter((call) => call.table !== 'merchants')).toHaveLength(0);
  });

  it('pide los conteos con una sola RPC y solo con los IDs de la página visible (sin N+1)', async () => {
    const MERCHANT_C = 'f0000000-0000-4000-8000-00000000000c';
    const { client } = mockClient(
      {
        merchants: {
          data: [merchantRow(MERCHANT_C), merchantRow(MERCHANT_B), merchantRow(MERCHANT_A)],
          error: null,
        },
      },
      {
        data: [
          { merchant_id: MERCHANT_B, delivered_count: 3 },
          { merchant_id: MERCHANT_C, delivered_count: 7 },
        ],
        error: null,
      }
    );

    const result = await getAdminMerchants({ pageSize: 2 });

    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith('admin_merchant_delivered_counts', {
      p_merchant_ids: [MERCHANT_C, MERCHANT_B],
    });
    expect(result.items.map((item) => [item.id, item.deliveredCount])).toEqual([
      [MERCHANT_C, 7],
      [MERCHANT_B, 3],
    ]);
    expect(result.nextCursor).toBe(`2026-10-01T12:00:00+00:00~${MERCHANT_B}`);
  });

  it('no llama a la RPC si la página está vacía', async () => {
    const { client } = mockClient({ merchants: { data: [], error: null } });
    const result = await getAdminMerchants();
    expect(client.rpc).not.toHaveBeenCalled();
    expect(result.items).toEqual([]);
  });

  it('un comercio sin solicitudes entregadas queda en 0', async () => {
    mockClient(
      { merchants: { data: [merchantRow(MERCHANT_B), merchantRow(MERCHANT_A)], error: null } },
      { data: [{ merchant_id: MERCHANT_B, delivered_count: 0 }], error: null }
    );

    const result = await getAdminMerchants();

    expect(result.items.map((item) => [item.id, item.deliveredCount])).toEqual([
      [MERCHANT_B, 0],
      [MERCHANT_A, 0],
    ]);
  });

  it('propaga el error de la RPC de conteos para el error boundary', async () => {
    mockClient(
      { merchants: { data: [merchantRow(MERCHANT_B)], error: null } },
      { data: null, error: { message: 'AAL2_REQUIRED' } }
    );
    await expect(getAdminMerchants()).rejects.toThrow(
      'Error al contar las solicitudes entregadas: AAL2_REQUIRED'
    );
  });

  it('rechaza una salida de la RPC con campos fuera del contrato (sin datos privados)', async () => {
    mockClient(
      { merchants: { data: [merchantRow(MERCHANT_B)], error: null } },
      {
        data: [{ merchant_id: MERCHANT_B, delivered_count: 1, notes: 'Timbre 2B' }],
        error: null,
      }
    );
    await expect(getAdminMerchants()).rejects.toThrow();
  });

  it('pagina server-side por cursor: limit(pageSize + 1), sin range()', async () => {
    const { calls } = mockClient({ merchants: { data: [], error: null } });
    await getAdminMerchants({ pageSize: 10 });

    // T-420: de la más nueva a la más vieja por fecha de registro, con el id para desempatar.
    expect(callsOf(calls, 'merchants', 'order').map((call) => call.args)).toEqual([
      ['profiles(created_at)', { ascending: false }],
      ['profile_id', { ascending: false }],
    ]);
    expect(callsOf(calls, 'merchants', 'limit')[0]?.args).toEqual([11]);
    expect(callsOf(calls, 'merchants', 'range')).toHaveLength(0);
    expect(callsOf(calls, 'merchants', 'or')).toHaveLength(0);
  });

  it('T-420: aplica el cursor «fecha~id» sobre el perfil embebido', async () => {
    const { calls } = mockClient({ merchants: { data: [], error: null } });
    await getAdminMerchants({ cursor: `2026-10-01T12:00:00+00:00~${MERCHANT_B}` });
    expect(callsOf(calls, 'merchants', 'or')[0]?.args).toEqual([
      `created_at.lt."2026-10-01T12:00:00+00:00",and(created_at.eq."2026-10-01T12:00:00+00:00",id.lt.${MERCHANT_B})`,
      { referencedTable: 'profiles' },
    ]);
    expect(callsOf(calls, 'merchants', 'lt')).toHaveLength(0);
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
    mockClient(
      {
        merchants: {
          data: [merchantRow(MERCHANT_B), merchantRow(MERCHANT_A, { cuit: '20-12345678-9' })],
          error: null,
        },
      },
      { data: [{ merchant_id: MERCHANT_B, delivered_count: 42 }], error: null }
    );

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
        createdAt: '2026-10-01T12:00:00+00:00',
        signupIncomplete: false,
      },
    ]);
    expect(result.hasNextPage).toBe(true);
    expect(result.nextCursor).toBe(`2026-10-01T12:00:00+00:00~${MERCHANT_B}`);
    expect(JSON.stringify(result)).not.toMatch(/cuit|20-12345678-9/i);
  });

  it('propaga el error de base para el error boundary', async () => {
    mockClient({ merchants: { data: null, error: { message: 'boom' } } });
    await expect(getAdminMerchants()).rejects.toThrow();
  });
});

describe('T-402: getAdminOperatorName (pie de la barra lateral)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const ADMIN_ID = 'a0000000-0000-4000-8000-000000000402';

  function withUser(client: object, id: string | null) {
    Object.assign(client, {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: id ? { id } : null }, error: null }) },
    });
  }

  it('lee el display_name del admin de la sesión con el cliente de sesión', async () => {
    const { client, calls } = mockClient({ profiles: { data: { display_name: '  Lautaro  ' }, error: null } });
    withUser(client, ADMIN_ID);

    await expect(getAdminOperatorName()).resolves.toBe('Lautaro');
    expect(callsOf(calls, 'profiles', 'eq')[0]?.args).toEqual(['id', ADMIN_ID]);
    expect(String(callsOf(calls, 'profiles', 'select')[0]?.args[0])).toBe('display_name');
    expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
  });

  it('sin nombre, sin sesión o con error de base devuelve «Operador sin nombre» sin romper el panel', async () => {
    const empty = mockClient({ profiles: { data: { display_name: ' ' }, error: null } });
    withUser(empty.client, ADMIN_ID);
    await expect(getAdminOperatorName()).resolves.toBe('Operador sin nombre');

    const broken = mockClient({ profiles: { data: null, error: { message: 'boom' } } });
    withUser(broken.client, ADMIN_ID);
    await expect(getAdminOperatorName()).resolves.toBe('Operador sin nombre');

    const anonymous = mockClient({});
    withUser(anonymous.client, null);
    await expect(getAdminOperatorName()).resolves.toBe('Operador sin nombre');
    expect(anonymous.calls).toEqual([]);
  });
});

describe('T-401: el hash del DNI no viaja al cliente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const HMAC = '97b2a93e5f0c4d1e8a7b6c5d4e3f2a1b';
  const COURIER = 'c0000000-0000-4000-8000-000000000401';
  const COURIER_B401 = 'c0000000-0000-4000-8000-000000000402';

  function queueRow(dniHmac: string | null) {
    return {
      profile_id: COURIER,
      status: 'pending',
      vehicle_type: 'moto',
      vehicle_plate: 'A123BCD',
      dni_hmac: dniHmac,
      doc_level: 1,
      license_status: 'none',
      insurance_status: 'none',
      profiles: { display_name: 'Juan Perez', phone: '3865123456', created_at: '2026-10-01T12:00:00Z' },
      courier_documents: [],
    };
  }

  it('la cola devuelve si el DNI está cargado, sin la propiedad dniHash ni el hash', async () => {
    const item = (id: string, hasDni: boolean) => ({
      id,
      displayName: 'Juan Perez',
      phone: '3865123456',
      vehicleType: 'moto',
      status: 'pending',
      hasDni,
      docLevel: 1,
      licenseStatus: 'none',
      insuranceStatus: 'none',
      createdAt: '2026-10-01T12:00:00.000000Z',
      submittedAt: null,
      documents: { dniFront: false, dniBack: false, selfie: false, license: false, insurance: false },
    });
    mockClient(
      {},
      { data: { items: [item(COURIER, true), item(COURIER_B401, false)], total: 2, nextCursor: null, prevCursor: null }, error: null }
    );

    const { items } = await getApplicantsQueue('pending');

    expect(items.map((entry) => entry.hasDni)).toEqual([true, false]);
    for (const entry of items) expect(entry).not.toHaveProperty('dniHash');
    expect(JSON.stringify(items)).not.toContain(HMAC.slice(0, 8));
  });

  it('el detalle devuelve si el DNI está cargado, sin la propiedad dniHash ni el hash', async () => {
    const decision = { decided_at: null, decided_by: null, deactivated_at: null };
    mockClient({
      couriers: { data: { ...queueRow(HMAC), ...decision }, error: null },
      courier_documents: { data: [], error: null },
    });

    const detail = await getApplicantDetail(COURIER);

    expect(detail?.hasDni).toBe(true);
    expect(detail).not.toHaveProperty('dniHash');
    expect(JSON.stringify(detail)).not.toContain(HMAC.slice(0, 8));

    mockClient({
      couriers: { data: { ...queueRow(null), ...decision }, error: null },
      courier_documents: { data: [], error: null },
    });
    expect((await getApplicantDetail(COURIER))?.hasDni).toBe(false);
  });
});

describe('T-401: comercio con el alta sin completar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('un business_name vacío o en blanco se devuelve con el texto de respaldo y marcado como alta sin completar', async () => {
    mockClient({
      merchants: {
        data: [
          merchantRow(MERCHANT_A, { business_name: '' }),
          merchantRow(MERCHANT_B, { business_name: '   ' }),
          merchantRow('f0000000-0000-4000-8000-00000000000c', { business_name: '  Kiosco Centro ' }),
        ],
        error: null,
      },
    });

    const { items } = await getAdminMerchants();

    expect(items.map((item) => [item.businessName, item.signupIncomplete])).toEqual([
      ['Alta sin completar', true],
      ['Alta sin completar', true],
      ['Kiosco Centro', false],
    ]);
    expect(items[0]?.ownerName).toBe('Rosa Díaz');
  });

  it('el encabezado de créditos usa el mismo texto de respaldo', async () => {
    mockClient({ merchants: { data: { profile_id: MERCHANT_A, business_name: ' ' }, error: null } });
    await expect(getAdminMerchantHeader(MERCHANT_A)).resolves.toEqual({
      id: MERCHANT_A,
      businessName: 'Alta sin completar',
    });
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
    { key: 'max_drops_per_request', value: 5 },
    // CC-029 (T-369): la migración inserta estas cinco; el precio de referencia queda sin fila hasta que se cargue.
    { key: 'publication_drops_per_credit', value: 2 },
    { key: 'carryover_base_pct', value: 5 },
    { key: 'carryover_step_pct', value: 5 },
    { key: 'carryover_cap_pct', value: 35 },
    { key: 'launch_discount_pct', value: 0 },
  ];

  it('devuelve los valores vigentes de platform_settings, no constantes', async () => {
    mockClient({ platform_settings: { data: rows, error: null } });
    await expect(getPlatformSettings()).resolves.toEqual({
      minOfferArs: 1500,
      requestTtlMinutes: 45,
      pilotActive: false,
      pilotTermsVersion: '1.1',
      subscriptionGraceDays: 3,
      maxDropsPerRequest: 5,
      courierOnlineWindowMinutes: 10,
      publicationDropsPerCredit: 2,
      carryoverBasePct: 5,
      carryoverStepPct: 5,
      carryoverCapPct: 35,
      launchDiscountPct: 0,
      looseCreditReferencePriceArs: null,
    });
    expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
  });

  it('T-369: lee el precio de referencia cuando está cargado y falla si falta un parámetro de créditos', async () => {
    mockClient({
      platform_settings: {
        data: [...rows, { key: 'loose_credit_reference_price_ars', value: 900 }],
        error: null,
      },
    });
    await expect(getPlatformSettings()).resolves.toMatchObject({ looseCreditReferencePriceArs: 900 });

    mockClient({
      platform_settings: { data: rows.filter((row) => row.key !== 'carryover_cap_pct'), error: null },
    });
    await expect(getPlatformSettings()).rejects.toThrow(/carryover_cap_pct/);
  });

  it('PR551-H04: lee la ventana de repartidores conectados guardada, no un valor fijo', async () => {
    mockClient({
      platform_settings: { data: [...rows, { key: 'courier_online_window_minutes', value: 27 }], error: null },
    });
    await expect(getPlatformSettings()).resolves.toMatchObject({ courierOnlineWindowMinutes: 27 });
  });

  it('PR551-H04: sin la fila de la ventana usa 10', async () => {
    expect(rows.some((row) => row.key === 'courier_online_window_minutes')).toBe(false);
    mockClient({ platform_settings: { data: rows, error: null } });
    await expect(getPlatformSettings()).resolves.toMatchObject({ courierOnlineWindowMinutes: 10 });
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

  it('T-407: el rango de fechas llega a la base como [gte, lt) con los bordes del día de Argentina en UTC', async () => {
    const { calls } = mockClient({ audit_log: { data: [], error: null } });
    await getAuditLog({ from: '2026-10-21', to: '2026-10-21' });

    expect(callsOf(calls, 'audit_log', 'gte').map((call) => call.args)).toEqual([
      ['created_at', '2026-10-21T03:00:00.000Z'],
    ]);
    expect(callsOf(calls, 'audit_log', 'lt').map((call) => call.args)).toEqual([
      ['created_at', '2026-10-22T03:00:00.000Z'],
    ]);
    expect(callsOf(calls, 'audit_log', 'lte')).toHaveLength(0);
  });

  it('T-407: filtra por targetId (y targetType) en la base', async () => {
    const target = 'c0000000-0000-4000-8000-000000000407';
    const { calls } = mockClient({ audit_log: { data: [], error: null } });
    await getAuditLog({ targetId: target, targetType: 'courier' });

    const eqArgs = callsOf(calls, 'audit_log', 'eq').map((call) => call.args);
    expect(eqArgs).toContainEqual(['target_id', target]);
    expect(eqArgs).toContainEqual(['target_type', 'courier']);
  });

  it('T-407: la primera página no ofrece «Anterior» ni consulta filas más nuevas', async () => {
    const { calls } = mockClient({ audit_log: { data: AUDIT_ROWS, error: null } });
    const page = await getAuditLog({ pageSize: 2 });

    expect(page.items.map((item) => item.id)).toEqual([90, 89]);
    expect(page).toMatchObject({ hasNextPage: true, nextCursor: 89, hasPrevPage: false, prevCursor: null });
    expect(callsOf(calls, 'audit_log', 'gte')).toHaveLength(0);
  });

  it('T-407: «Siguiente» con cursor busca filas más nuevas con los mismos filtros para ofrecer «Anterior»', async () => {
    const { calls } = mockClient({ audit_log: { data: AUDIT_ROWS, error: null } });
    const page = await getAuditLog({ pageSize: 2, cursor: 91, action: 'admin_update_setting' });

    expect(callsOf(calls, 'audit_log', 'lt')[0]?.args).toEqual(['id', 91]);
    expect(callsOf(calls, 'audit_log', 'gte').map((call) => call.args)).toEqual([['id', 91]]);
    // El sondeo repite el filtro de evento: si no, ofrecería «Anterior» hacia filas que el filtro excluye.
    expect(callsOf(calls, 'audit_log', 'eq').filter((call) => call.args[0] === 'action')).toHaveLength(2);
    expect(page).toMatchObject({ prevCursor: 90, hasPrevPage: true, nextCursor: 89, hasNextPage: true });
  });

  it('T-407: «Anterior» (dir=prev) lee las más viejas por encima del cursor en orden ascendente y las devuelve de nueva a vieja', async () => {
    const ascending = [...AUDIT_ROWS].reverse();
    const { calls } = mockClient({ audit_log: { data: ascending, error: null } });
    const page = await getAuditLog({ pageSize: 2, cursor: 87, direction: 'prev' });

    expect(callsOf(calls, 'audit_log', 'gt')[0]?.args).toEqual(['id', 87]);
    expect(callsOf(calls, 'audit_log', 'order')[0]?.args).toEqual(['id', { ascending: true }]);
    expect(callsOf(calls, 'audit_log', 'lte').map((call) => call.args)).toEqual([['id', 87]]);
    expect(page.items.map((item) => item.id)).toEqual([89, 88]);
    expect(page).toMatchObject({ hasPrevPage: true, prevCursor: 89, hasNextPage: true, nextCursor: 88 });
  });

  it('T-407: ida y vuelta: «Anterior» desde la página 2 vuelve a las mismas filas de la página 1', async () => {
    mockClient({ audit_log: { data: AUDIT_ROWS, error: null } });
    const first = await getAuditLog({ pageSize: 1 });
    expect(first.items.map((item) => item.id)).toEqual([90]);

    mockClient({ audit_log: { data: AUDIT_ROWS.slice(1), error: null } });
    const second = await getAuditLog({ pageSize: 1, cursor: first.nextCursor ?? undefined });
    expect(second.items.map((item) => item.id)).toEqual([89]);

    // Lo que devuelve la base para id > 89 ascendente: solo la 90; no hay más nuevas.
    mockClient({ audit_log: { data: [AUDIT_ROWS[0]], error: null } });
    const back = await getAuditLog({ pageSize: 1, cursor: second.prevCursor ?? undefined, direction: 'prev' });
    expect(back.items.map((item) => item.id)).toEqual(first.items.map((item) => item.id));
    expect(back).toMatchObject({ hasPrevPage: false, prevCursor: null, hasNextPage: true, nextCursor: 90 });
  });

  it('T-407: «Anterior» sin filas más viejas detrás del cursor no ofrece «Siguiente»', async () => {
    const { client } = mockClient({ audit_log: { data: [AUDIT_ROWS[0]], error: null } });
    const empty = { data: [], error: null };
    const builder = (result: unknown) => {
      const b: Record<string, unknown> = { then: (r: (v: unknown) => unknown) => Promise.resolve(result).then(r) };
      for (const method of ['select', 'eq', 'gt', 'lte', 'order', 'limit']) b[method] = () => b;
      return b;
    };
    client.from
      .mockImplementationOnce(() => builder({ data: [AUDIT_ROWS[0]], error: null }))
      .mockImplementationOnce(() => builder(empty));
    const page = await getAuditLog({ pageSize: 1, cursor: 89, direction: 'prev' });
    expect(page).toMatchObject({ hasNextPage: false, nextCursor: null });
  });

  it('no selecciona columnas de contacto ni PII del operador', async () => {
    const { calls } = mockClient({ audit_log: { data: [], error: null } });
    await getAuditLog();
    const columns = String(callsOf(calls, 'audit_log', 'select')[0]?.args[0]);
    expect(columns).not.toMatch(/phone|email|dni/i);
  });

  it('devuelve nextCursor y el detalle saneado sin notas libres (el motivo del admin sí, T-400)', async () => {
    mockClient({ audit_log: { data: AUDIT_ROWS, error: null } });

    const result = await getAuditLog({ pageSize: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.hasNextPage).toBe(true);
    expect(result.nextCursor).toBe(89);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('Juan Pérez');
    expect(serialized).not.toContain('3865 44-1122');

    const [subscription, decision] = result.items;
    expect(subscription).toMatchObject({
      id: 90,
      actorName: 'Lautaro',
      action: 'admin_set_subscription',
      targetType: 'merchant',
      reason: null,
    });
    expect(subscription?.changes).toEqual(
      expect.arrayContaining([
        { field: 'subscription_status', before: 'pilot', after: 'active' },
        { field: 'paid_until', before: null, after: '2026-10-31' },
      ])
    );
    expect(decision).toMatchObject({ reason: 'DNI 30111222 ilegible' });
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

const T400_ADMIN = 'a0000000-0000-4000-8000-000000000001';
const T400_COURIER = 'b0000000-0000-4000-8000-000000000002';
const T400_DOC_OWNER = 'b0000000-0000-4000-8000-000000000003';
const T400_DOC_VERIFIED = 'd0000000-0000-4000-8000-000000000001';
const T400_DOC_REPLACED = 'd0000000-0000-4000-8000-000000000002';
const T400_REQUEST = 'e1a2b3c4-0000-4000-8000-000000000001';
const T400_INCIDENT = '90000000-0000-4000-8000-000000000001';

function auditRow(
  id: number,
  action: string,
  targetType: string,
  targetId: string,
  before: unknown,
  after: unknown
) {
  return {
    id,
    created_at: '2026-10-21T12:00:00.000Z',
    actor_id: T400_ADMIN,
    action,
    target_type: targetType,
    target_id: targetId,
    before,
    after,
    profiles: { display_name: 'Lautaro' },
  };
}

describe('T-400: getAuditLog (motivos del admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra el motivo completo solo en decidir, suspender, rehabilitar y revisar documentos', async () => {
    // PR582-H01: espacios y saltos en los extremos incluidos; el motivo no se recorta.
    const reason = '\n  Línea 1 <b>sin HTML</b>\nLínea 2 con el texto completo del admin  \n';
    mockClient({
      audit_log: {
        data: [
          auditRow(6, 'admin_decide_courier', 'courier', T400_COURIER, { status: 'pending' }, { status: 'approved', reason }),
          auditRow(5, 'admin_suspend_courier', 'courier', T400_COURIER, { status: 'approved' }, { status: 'suspended', reason, withdrawnOffersCount: 0 }),
          auditRow(4, 'admin_reinstate_courier', 'courier', T400_COURIER, { status: 'suspended' }, { status: 'approved', reason }),
          auditRow(3, 'admin_verify_document', 'courier_document', T400_DOC_VERIFIED, { status: 'submitted', kind: 'license', courier_id: T400_DOC_OWNER }, { status: 'rejected', reason, docLevel: 1 }),
          auditRow(2, 'admin_resolve_incident', 'incident', T400_INCIDENT, { status: 'open' }, { status: 'resolved', reason: 'Datos del destinatario: Calle Falsa 123' }),
          auditRow(1, 'admin_decide_courier', 'courier', T400_COURIER, { status: 'pending' }, { status: 'approved', reason: '   ' }),
        ],
        error: null,
      },
    });

    const { items } = await getAuditLog();

    expect(items.slice(0, 4).map((item) => item.reason)).toEqual([reason, reason, reason, reason]);
    expect(items[4]?.reason).toBeNull();
    expect(items[5]?.reason).toBeNull();
    expect(JSON.stringify(items)).not.toContain('Calle Falsa');
  });

  it('PR582-H01: conserva el motivo exacto, con espacios y salto final', async () => {
    const exactReason = '  Primera línea\nSegunda línea  \n';
    mockClient({
      audit_log: {
        data: [
          auditRow(100, 'admin_suspend_courier', 'courier', T400_COURIER, { status: 'approved' }, { status: 'suspended', reason: exactReason }),
        ],
        error: null,
      },
    });
    expect((await getAuditLog()).items[0]?.reason).toBe(exactReason);
  });
});

describe('T-400: getAuditLog (nombres de la entidad resueltos en el servidor)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const rows = [
    auditRow(7, 'admin_reinstate_courier', 'courier', T400_COURIER, { status: 'suspended' }, { status: 'approved', reason: 'ok' }),
    auditRow(6, 'admin_verify_document', 'courier_document', T400_DOC_VERIFIED, { status: 'submitted', kind: 'license', courier_id: T400_DOC_OWNER }, { status: 'verified', docLevel: 2 }),
    auditRow(5, 'replace_courier_document', 'courier_document', T400_DOC_REPLACED, { kind: 'insurance' }, { kind: 'insurance', status: 'submitted' }),
    auditRow(4, 'admin_set_subscription', 'merchant', MERCHANT_A, { subscription_status: 'pilot' }, { subscription_status: 'active' }),
    auditRow(3, 'admin_grant_publication_credits', 'merchant', MERCHANT_B, null, { credits: 10 }),
    auditRow(2, 'cancel_request', 'delivery_request', T400_REQUEST, { status: 'published' }, { status: 'cancelled' }),
    auditRow(1, 'admin_resolve_incident', 'incident', T400_INCIDENT, { status: 'open' }, { status: 'resolved' }),
    auditRow(0, 'admin_update_setting', 'platform_setting', 'min_offer_ars', { value: 1000 }, { value: 1500 }),
  ];

  function namedClient() {
    return mockClient({
      audit_log: { data: rows, error: null },
      courier_documents: {
        data: [{ id: T400_DOC_REPLACED, courier_id: T400_COURIER, kind: 'insurance' }],
        error: null,
      },
      profiles: {
        data: [
          { id: T400_COURIER, display_name: 'Ana Gómez' },
          { id: T400_DOC_OWNER, display_name: 'Bruno Díaz' },
        ],
        error: null,
      },
      merchants: {
        data: [
          { profile_id: MERCHANT_A, business_name: 'Panadería Sol', profiles: { display_name: 'Carla' } },
          { profile_id: MERCHANT_B, business_name: '  ', profiles: { display_name: 'Diego Ruiz' } },
        ],
        error: null,
      },
    });
  }

  it('resuelve el nombre del afectado de cada tipo', async () => {
    namedClient();
    const { items } = await getAuditLog();
    const byId = new Map(items.map((item) => [item.id, item]));

    expect(byId.get(7)).toMatchObject({ targetName: 'Ana Gómez', targetRef: 'b0000000' });
    expect(byId.get(6)).toMatchObject({
      targetName: 'Bruno Díaz · Licencia de Conducir',
      targetRef: 'd0000000',
    });
    expect(byId.get(5)).toMatchObject({ targetName: 'Ana Gómez · Seguro de Vehículo' });
    expect(byId.get(4)).toMatchObject({ targetName: 'Panadería Sol', targetRef: 'f0000000' });
    expect(byId.get(3)).toMatchObject({ targetName: 'Diego Ruiz' });
    expect(byId.get(2)).toMatchObject({ targetName: 'REQ-E1A2B3C4' });
    expect(byId.get(1)).toMatchObject({ targetName: null, targetRef: '90000000' });
    expect(byId.get(0)).toMatchObject({ targetName: null, targetRef: 'min_offer_ars' });
  });

  it('consulta en lote, una vez por tipo y con los ids completos (sin N+1)', async () => {
    const { client, calls } = namedClient();
    await getAuditLog();

    const tables = client.from.mock.calls.map(([table]) => table);
    expect(tables.filter((table) => table === 'profiles')).toHaveLength(1);
    expect(tables.filter((table) => table === 'merchants')).toHaveLength(1);
    expect(tables.filter((table) => table === 'courier_documents')).toHaveLength(1);

    expect(callsOf(calls, 'courier_documents', 'in')[0]?.args).toEqual(['id', [T400_DOC_REPLACED]]);
    const [profileColumn, profileIds] = callsOf(calls, 'profiles', 'in')[0]?.args ?? [];
    expect(profileColumn).toBe('id');
    expect([...(profileIds as string[])].sort()).toEqual([T400_COURIER, T400_DOC_OWNER].sort());
    const [merchantColumn, merchantIds] = callsOf(calls, 'merchants', 'in')[0]?.args ?? [];
    expect(merchantColumn).toBe('profile_id');
    expect([...(merchantIds as string[])].sort()).toEqual([MERCHANT_A, MERCHANT_B].sort());
  });

  it('al navegador no llega ningún id completo', async () => {
    namedClient();
    const serialized = JSON.stringify(await getAuditLog());
    for (const fullId of [
      T400_COURIER,
      T400_DOC_OWNER,
      T400_DOC_VERIFIED,
      T400_DOC_REPLACED,
      MERCHANT_A,
      MERCHANT_B,
      T400_REQUEST,
      T400_INCIDENT,
    ]) {
      expect(serialized).not.toContain(fullId);
    }
  });

  it('sin fila o sin permiso, cae al id corto sin error', async () => {
    mockClient({
      audit_log: { data: rows, error: null },
      profiles: { data: null, error: { message: 'permission denied' } },
      merchants: { data: [], error: null },
      courier_documents: { data: [], error: null },
    });

    const { items } = await getAuditLog();
    expect(items.find((item) => item.id === 7)).toMatchObject({ targetName: null, targetRef: 'b0000000' });
    expect(items.find((item) => item.id === 4)).toMatchObject({ targetName: null, targetRef: 'f0000000' });
    expect(items.find((item) => item.id === 2)).toMatchObject({ targetName: 'REQ-E1A2B3C4' });
  });

  it('una página sin entidades con nombre no hace consultas extra', async () => {
    const { client } = mockClient({ audit_log: { data: [rows[7]], error: null } });
    await getAuditLog();
    expect(client.from.mock.calls.map(([table]) => table)).toEqual(['audit_log']);
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
    expect(selectStr).toMatch(/profiles!merchants_profile_id_fkey(!inner)?\s*\(/);
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

describe('T-369 / CC-029: catálogo de planes y créditos del comercio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const PLAN_ITEMS = [
    { id: 'f0000000-0000-4000-8000-000000000001', code: 'plan-40', name: 'Plan 40', kind: 'quota', monthlyCredits: 40, referencePriceArs: 20000, active: true, sort: 1 },
    { id: 'f0000000-0000-4000-8000-000000000002', code: 'ilimitado', name: 'Ilimitado', kind: 'unlimited', monthlyCredits: null, referencePriceArs: null, active: false, sort: 1 },
  ];

  function mockAdminSession(role: string | null, aal: 'aal1' | 'aal2') {
    const rpc = vi.fn();
    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: role ? { id: 'admin-1' } : null }, error: null }),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: { currentLevel: aal }, error: null }),
        },
      },
      from: vi.fn(),
      rpc,
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);
    return rpc;
  }

  it('PR402-H04: el catálogo se pide a admin_list_publication_plans con la sesión, nunca con service role', async () => {
    const rpc = mockAdminSession('admin', 'aal2');
    rpc.mockResolvedValue({ data: { items: PLAN_ITEMS, nextCursor: null }, error: null });
    await expect(getPublicationPlans()).resolves.toEqual({ ok: true, data: { items: PLAN_ITEMS, nextCursor: null } });
    expect(rpc).toHaveBeenCalledWith('admin_list_publication_plans', {
      p_limit: 50,
      p_after_sort: null,
      p_after_id: null,
      p_active_only: false,
    });
    expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
  });

  it('PR402-H04: los rechazos de autorización de la RPC llegan tal cual a la página', async () => {
    for (const code of ['UNAUTHENTICATED', 'UNAUTHORIZED_ACTOR', 'AAL2_REQUIRED'] as const) {
      const rpc = mockAdminSession('admin', 'aal1');
      rpc.mockResolvedValue({ data: null, error: { message: code, code: 'P0001' } });
      await expect(getPublicationPlans()).resolves.toEqual({ ok: false, code });
    }
    expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
  });

  it('PR402-H03: pasa el cursor (sort, id) y el filtro, y devuelve el cursor siguiente', async () => {
    const rpc = mockAdminSession('admin', 'aal2');
    const next = { sort: 1, id: PLAN_ITEMS[0]?.id };
    rpc.mockResolvedValue({ data: { items: [PLAN_ITEMS[0]], nextCursor: next }, error: null });
    const result = await getPublicationPlans({
      activeOnly: true,
      after: { sort: 0, id: 'f0000000-0000-4000-8000-000000000099' },
    });
    expect(result).toEqual({ ok: true, data: { items: [PLAN_ITEMS[0]], nextCursor: next } });
    expect(rpc).toHaveBeenCalledWith('admin_list_publication_plans', {
      p_limit: 50,
      p_after_sort: 0,
      p_after_id: 'f0000000-0000-4000-8000-000000000099',
      p_active_only: true,
    });
  });

  it('una respuesta fuera del contrato o un error de base no se muestran como catálogo', async () => {
    const rpc = mockAdminSession('admin', 'aal2');
    rpc.mockResolvedValueOnce({ data: { items: [{ ...PLAN_ITEMS[0], kind: 'gold' }], nextCursor: null }, error: null });
    await expect(getPublicationPlans()).resolves.toEqual({ ok: false, code: 'INTERNAL_ERROR' });
    rpc.mockResolvedValueOnce({ data: { items: PLAN_ITEMS, nextCursor: { sort: 1 } }, error: null });
    await expect(getPublicationPlans()).resolves.toEqual({ ok: false, code: 'INTERNAL_ERROR' });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom', code: 'XX000' } });
    await expect(getPublicationPlans()).resolves.toEqual({ ok: false, code: 'INTERNAL_ERROR' });
  });

  it('PR402-H03: la URL del catálogo solo arma un cursor completo y válido', () => {
    const id = 'f0000000-0000-4000-8000-000000000050';
    expect(parsePublicationPlansParams({ afterSort: '3', afterId: id, active: '1' })).toEqual({
      activeOnly: true,
      after: { sort: 3, id },
    });
    expect(parsePublicationPlansParams({})).toEqual({ activeOnly: false, after: null });
    for (const raw of [{ afterSort: '3' }, { afterId: id }, { afterSort: 'x', afterId: id }, { afterSort: '3', afterId: 'nope' }, { afterSort: '-1', afterId: id }]) {
      expect(parsePublicationPlansParams(raw).after).toBeNull();
    }
    expect(parsePublicationPlansParams({ afterSort: ['4', '9'], afterId: [id], active: ['0'] })).toEqual({
      activeOnly: false,
      after: { sort: 4, id },
    });
  });

  it('el saldo del comercio se pide por RPC con la sesión, de a 50 y con el cursor recibido', async () => {
    const rpc = mockAdminSession('admin', 'aal2');
    rpc.mockResolvedValue({ data: null, error: { message: 'AAL2_REQUIRED', code: 'P0001' } });
    await expect(
      getAdminMerchantPublicationCredits({ merchantId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', beforeId: 12 })
    ).resolves.toEqual({ ok: false, code: 'AAL2_REQUIRED' });
    expect(rpc).toHaveBeenCalledWith('admin_get_merchant_publication_credits', {
      p_merchant_id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
      p_limit: 50,
      p_before_id: 12,
    });
    expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
  });
});

describe('T-404: detalle con consentimientos e historial real (getApplicantDetail)', () => {
  const COURIER = 'c0000000-0000-4000-8000-000000000404';
  const DOC = 'd0000000-0000-4000-8000-000000000404';

  function courierRow(overrides: Record<string, unknown> = {}) {
    return {
      profile_id: COURIER,
      status: 'suspended',
      vehicle_type: 'moto',
      vehicle_plate: 'AE 404 EE',
      dni_hmac: 'ab'.repeat(32),
      doc_level: 1,
      license_status: 'none',
      insurance_status: 'none',
      decided_at: null,
      decided_by: null,
      deactivated_at: null,
      submitted_at: '2026-11-01T11:00:00+00:00',
      profiles: { display_name: 'José Pérez', phone: '3865123456', created_at: '2026-11-01T10:00:00+00:00' },
      ...overrides,
    };
  }

  // Las filas llegan como las pide la consulta: las más nuevas primero.
  const auditRows = [
    {
      id: 3,
      created_at: '2026-11-03T10:00:00+00:00',
      actor_id: 'e0000000-0000-4000-8000-000000000001',
      action: 'admin_suspend_courier',
      target_type: 'courier',
      target_id: COURIER,
      before: { status: 'approved' },
      after: { status: 'suspended', reason: 'Reclamos reiterados' },
      profiles: { display_name: 'Lautaro' },
    },
    {
      id: 2,
      created_at: '2026-11-02T10:00:00+00:00',
      actor_id: 'e0000000-0000-4000-8000-000000000001',
      action: 'view_courier_document',
      target_type: 'courier_document',
      target_id: DOC,
      before: null,
      after: { kind: 'dni_front', courier_id: COURIER },
      profiles: { display_name: 'Lautaro' },
    },
  ];

  function mockDetail(courier: Record<string, unknown>, audit: unknown[] = auditRows) {
    return mockClient({
      couriers: { data: courier, error: null },
      courier_documents: {
        data: [
          { id: DOC, kind: 'dni_front', storage_path: `${COURIER}/dni_front.webp`, status: 'submitted', uploaded_at: '2026-11-01T10:30:00+00:00' },
        ],
        error: null,
      },
      consents: {
        data: [
          { document: 'tos', version: '2026-10', accepted_at: '2026-11-01T10:01:00+00:00' },
          { document: 'courier_contract', version: '1', accepted_at: '2026-11-01T10:02:00+00:00' },
        ],
        error: null,
      },
      audit_log: { data: audit, error: null },
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('el historial va del más viejo al más nuevo: Registrado, Postulación enviada y las filas reales de auditoría', async () => {
    mockDetail(courierRow());
    const detail = await getApplicantDetail(COURIER);

    expect(detail?.history?.map((event) => [event.kind, event.at])).toEqual([
      ['registered', '2026-11-01T10:00:00+00:00'],
      ['submitted', '2026-11-01T11:00:00+00:00'],
      ['audit', '2026-11-02T10:00:00+00:00'],
      ['audit', '2026-11-03T10:00:00+00:00'],
    ]);
    expect(detail?.history?.[2]).toMatchObject({ label: 'Vio un documento', detail: 'DNI Frente', reason: null });
    expect(detail?.history?.[3]).toMatchObject({
      label: 'Suspendió un repartidor',
      reason: 'Reclamos reiterados',
      actorName: 'Lautaro',
    });
  });

  it('sin submitted_at no hay «Postulación enviada» ni eventos que la base no registre', async () => {
    mockDetail(courierRow({ submitted_at: null }), []);
    const detail = await getApplicantDetail(COURIER);

    expect(detail?.history).toEqual([{ kind: 'registered', id: 'registered', at: '2026-11-01T10:00:00+00:00' }]);
  });

  /** N filas como las devuelve la consulta (`created_at DESC`, nunca más de su `limit(50)`). */
  function auditPage(count: number) {
    return Array.from({ length: count }, (_, index) => ({
      ...auditRows[0],
      id: 100 - index,
      created_at: new Date(Date.UTC(2026, 10, 3, 10, count - index)).toISOString(),
    }));
  }

  it.each([0, 49, 50])(
    'PR607-H01 (D03 = C): con %i filas de auditoría conserva los dos hitos, sin recortar el total',
    async (count) => {
      mockDetail(courierRow(), auditPage(count));
      const history = (await getApplicantDetail(COURIER))?.history ?? [];

      expect(history).toHaveLength(count + 2);
      expect(history.filter((event) => event.kind !== 'audit').map((event) => event.kind)).toEqual([
        'registered',
        'submitted',
      ]);
      expect(history.filter((event) => event.kind === 'audit')).toHaveLength(count);
      const times = history.map((event) => new Date(event.at).getTime());
      expect(times).toEqual([...times].sort((a, b) => a - b));
    }
  );

  it('PR607-H01: los empates de fecha se ordenan igual siempre (hitos primero, auditoría por id)', async () => {
    const at = '2026-11-01T10:00:00+00:00';
    mockDetail(courierRow({ submitted_at: at }), [
      { ...auditRows[0], id: 8, created_at: at },
      { ...auditRows[0], id: 7, created_at: at },
    ]);
    const history = (await getApplicantDetail(COURIER))?.history ?? [];
    expect(history.map((event) => event.id)).toEqual(['registered', 'submitted', 'audit-7', 'audit-8']);
  });

  it('la auditoría se filtra por el repartidor y sus documentos, con la sesión del admin y hasta 50 filas', async () => {
    const { calls } = mockDetail(courierRow());
    await getApplicantDetail(COURIER);

    expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
    const [filter] = callsOf(calls, 'audit_log', 'or');
    expect(String(filter?.args[0])).toBe(
      `and(target_type.eq.courier,target_id.eq.${COURIER}),and(target_type.eq.courier_document,or(after->>courier_id.eq.${COURIER},before->>courier_id.eq.${COURIER},target_id.in.(${DOC})))`
    );
    expect(callsOf(calls, 'audit_log', 'order')[0]?.args).toEqual(['created_at', { ascending: false }]);
    expect(callsOf(calls, 'audit_log', 'limit')[0]?.args).toEqual([50]);
  });

  it('los consentimientos salen de consents con documento, versión y fecha', async () => {
    const { calls } = mockDetail(courierRow());
    const detail = await getApplicantDetail(COURIER);

    expect(callsOf(calls, 'consents', 'eq')[0]?.args).toEqual(['profile_id', COURIER]);
    expect(detail?.consents).toEqual([
      { document: 'tos', version: '2026-10', acceptedAt: '2026-11-01T10:01:00+00:00' },
      { document: 'courier_contract', version: '1', acceptedAt: '2026-11-01T10:02:00+00:00' },
    ]);
  });
});

describe('PR607-D02: getAuditLog filtrado por repartidor', () => {
  const COURIER = 'c0000000-0000-4000-8000-000000000607';
  const DOC = 'd0000000-0000-4000-8000-000000000607';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('trae los eventos del repartidor y de sus documentos (id o courier_id), paginados por id', async () => {
    const { calls } = mockClient({
      courier_documents: { data: [{ id: DOC }], error: null },
      audit_log: { data: [], error: null },
    });
    await getAuditLog({ courierId: COURIER, pageSize: 20 });

    expect(callsOf(calls, 'courier_documents', 'eq')[0]?.args).toEqual(['courier_id', COURIER]);
    expect(String(callsOf(calls, 'audit_log', 'or')[0]?.args[0])).toBe(
      `and(target_type.eq.courier,target_id.eq.${COURIER}),and(target_type.eq.courier_document,or(after->>courier_id.eq.${COURIER},before->>courier_id.eq.${COURIER},target_id.in.(${DOC})))`
    );
    expect(callsOf(calls, 'audit_log', 'order')[0]?.args).toEqual(['id', { ascending: false }]);
    expect(callsOf(calls, 'audit_log', 'limit')[0]?.args).toEqual([21]);
  });

  it('el filtro se aplica en la base antes del limit(pageSize + 1) y no menciona a otro repartidor', async () => {
    const { calls } = mockClient({
      courier_documents: { data: [], error: null },
      audit_log: { data: [], error: null },
    });
    await getAuditLog({ courierId: COURIER, targetType: 'courier_document', cursor: 90 });

    const auditCalls = calls.filter((call) => call.table === 'audit_log').map((call) => call.method);
    expect(auditCalls.indexOf('or')).toBeLessThan(auditCalls.indexOf('limit'));
    expect(callsOf(calls, 'audit_log', 'eq')[0]?.args).toEqual(['target_type', 'courier_document']);
    expect(callsOf(calls, 'audit_log', 'lt')[0]?.args).toEqual(['id', 90]);
    const filter = String(callsOf(calls, 'audit_log', 'or')[0]?.args[0]);
    expect(filter).toContain(`after->>courier_id.eq.${COURIER},before->>courier_id.eq.${COURIER}`);
    expect(filter).not.toContain('target_id.in.');
    expect(filter.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)).toEqual([
      COURIER,
      COURIER,
      COURIER,
    ]);
    expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
  });

  it('si falla la lectura de documentos del repartidor, el error se propaga', async () => {
    mockClient({
      courier_documents: { data: null, error: { message: 'permission denied' } },
      audit_log: { data: [], error: null },
    });
    await expect(getAuditLog({ courierId: COURIER })).rejects.toThrow('permission denied');
  });

  it('sin filtro por repartidor no consulta documentos ni agrega el or()', async () => {
    const { calls } = mockClient({ audit_log: { data: [], error: null } });
    await getAuditLog();
    expect(callsOf(calls, 'audit_log', 'or')).toHaveLength(0);
    expect(calls.filter((call) => call.table === 'courier_documents')).toHaveLength(0);
  });
});
