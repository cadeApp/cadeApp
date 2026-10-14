import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import { createDeliveryRequestAction } from './actions';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

// #209: `callRequestRpc` corre real. Solo se aíslan sus efectos post-commit (push y alertas).
vi.mock('@/server/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
      }),
    }),
  })),
}));

vi.mock('@/server/push', () => ({
  safeNotifyPostTransition: vi.fn(),
}));

vi.mock('@/server/observability', () => ({
  sendCriticalAlert: vi.fn(),
}));

type MockedServerClient = Awaited<ReturnType<typeof serverSupabase.createClient>>;

const PUBLISHED_AT = '2026-10-02T12:00:00.000Z';
const EXPIRES_AT = '2026-10-02T12:30:00.000Z';

function publishedRpcResponse(requestId: string, dropsCount = 1) {
  return {
    data: {
      requestId,
      status: 'published',
      publishedAt: PUBLISHED_AT,
      expiresAt: EXPIRES_AT,
      routeDistanceM: 1000,
      fixedPriceArs: null,
      autoAssign: false,
      dropsCount,
    },
    error: null,
  };
}

function rejectedRpcResponse(code: string) {
  return { data: null, error: { code: 'P0001', message: code } };
}

describe('T-340: createDeliveryRequestAction multi-drop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validPickupZoneId = '11111111-1111-4111-8111-111111111111';
  const validDropoffZoneId1 = '22222222-2222-4222-8222-222222222222';
  const validDropoffZoneId2 = '33333333-3333-4333-8333-333333333333';
  const validDropoffZoneId3 = '44444444-4444-4444-8444-444444444444';
  const createdRequestId = '33333333-3333-4333-8333-333333333333';

  const validDrop1 = {
    dropoffZoneId: validDropoffZoneId1,
    dropoffAddress: 'San Martín 450',
    dropoffLat: -27.435,
    dropoffLng: -65.615,
    recipientName: 'Juan Pérez',
    recipientPhone: '3815551234',
    recipientConsentDeclared: true as const,
    packageType: 'mediano' as const,
    recipientPaymentMethod: 'cash' as const,
    needsChange: true,
    cashChangeAmount: 5000,
    notes: 'Tocar timbre blanco',
  };

  const validDrop2 = {
    dropoffZoneId: validDropoffZoneId2,
    dropoffAddress: 'Av. Sarmiento 800',
    dropoffLat: -27.432,
    dropoffLng: -65.612,
    recipientName: 'María López',
    recipientPhone: '3815559876',
    recipientConsentDeclared: true as const,
    packageType: 'chico' as const,
    recipientPaymentMethod: 'transfer' as const,
    needsChange: false,
    cashChangeAmount: null,
    notes: 'Piso 2 Depto B',
  };

  const validDrop3 = {
    dropoffZoneId: validDropoffZoneId3,
    dropoffAddress: 'Mitre 210',
    dropoffLat: null,
    dropoffLng: null,
    recipientName: 'Carlos Gómez',
    recipientPhone: '3815554321',
    recipientConsentDeclared: true as const,
    packageType: 'grande' as const,
    recipientPaymentMethod: 'cash' as const,
    needsChange: false,
    cashChangeAmount: null,
    notes: 'Dejar en recepción',
  };

  const validFormInput = {
    pickupZoneId: validPickupZoneId,
    pickupAddress: 'Av. Sarmiento 120',
    pickupLat: -27.43,
    pickupLng: -65.61,
    fixedPriceArs: null,
    autoAssign: false,
    drops: [validDrop1],
  };

  it('rechaza si no hay sesión autenticada con UNAUTHENTICATED', async () => {
    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as unknown as MockedServerClient);

    const result = await createDeliveryRequestAction(validFormInput);
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
            data: { role: 'courier' },
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
    } as unknown as MockedServerClient);

    const result = await createDeliveryRequestAction(validFormInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('UNAUTHORIZED_ACTOR');
    }
  });

  it('rechaza input inválido con VALIDATION_ERROR', async () => {
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
          data: { user: { id: 'usr-merchant-1', email: 'merchant@test.com' } },
          error: null,
        }),
      },
      from: mockFrom,
    } as unknown as MockedServerClient);

    const invalidInput = {
      ...validFormInput,
      drops: [], // 0 drops
    };

    const result = await createDeliveryRequestAction(invalidInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('VALIDATION_ERROR');
    }
  });

  it('crea solicitud exitosa con 1 drop y persiste en tablas hijas', async () => {
    let insertedRequest: Record<string, unknown> | null = null;
    let insertedContacts: Record<string, unknown> | null = null;
    let insertedDrops: unknown = null;
    let insertedDropContacts: unknown = null;
    const createdDropId = '99999999-9999-4999-8999-999999999999';
    const mockRpc = vi.fn().mockResolvedValue(publishedRpcResponse(createdRequestId, 1));

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
      if (table === 'delivery_requests') {
        return {
          insert: vi.fn().mockImplementation((payload) => {
            insertedRequest = payload;
            return {
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: createdRequestId },
                error: null,
              }),
            };
          }),
        };
      }
      if (table === 'delivery_request_contacts') {
        return {
          insert: vi.fn().mockImplementation((payload) => {
            insertedContacts = payload;
            return Promise.resolve({ error: null });
          }),
        };
      }
      if (table === 'delivery_request_drops') {
        return {
          insert: vi.fn().mockImplementation((payload) => {
            insertedDrops = payload;
            return {
              select: vi.fn().mockResolvedValue({
                data: [{ id: createdDropId, position: 1 }],
                error: null,
              }),
            };
          }),
        };
      }
      if (table === 'delivery_request_drop_contacts') {
        return {
          insert: vi.fn().mockImplementation((payload) => {
            insertedDropContacts = payload;
            return Promise.resolve({ error: null });
          }),
        };
      }
      return {};
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-merchant-1', email: 'merchant@test.com' } },
          error: null,
        }),
      },
      from: mockFrom,
      rpc: mockRpc,
    } as unknown as MockedServerClient);

    const result = await createDeliveryRequestAction(validFormInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.requestId).toBe(createdRequestId);
      expect(result.data.redirectTo).toBe('/merchant/dashboard');
    }
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('publish_request', { p_request_id: createdRequestId });

    // Verificación delivery_requests: status draft, drops_count=1, notes=null, cash_change_amount=null
    expect(insertedRequest).toMatchObject({
      merchant_id: 'usr-merchant-1',
      pickup_zone_id: validPickupZoneId,
      drops_count: 1,
      status: 'draft',
      notes: null,
      cash_change_amount: null,
      fixed_price_ars: null,
      auto_assign: false,
    });
    // Sin campos legacy de destino en delivery_requests
    expect((insertedRequest as unknown as Record<string, unknown>)?.['dropoff_zone_id']).toBeUndefined();
    expect((insertedRequest as unknown as Record<string, unknown>)?.['package_type']).toBeUndefined();

    // Verificación delivery_request_contacts: solo datos de retiro
    expect(insertedContacts).toMatchObject({
      request_id: createdRequestId,
      pickup_address: 'Av. Sarmiento 120',
      pickup_lat: -27.43,
      pickup_lng: -65.61,
      dropoff_address: null,
      recipient_name: null,
      recipient_phone: null,
    });

    // Verificación delivery_request_drops: 1 drop
    expect(insertedDrops).toEqual([
      {
        request_id: createdRequestId,
        position: 1,
        dropoff_zone_id: validDropoffZoneId1,
        package_type: 'mediano',
        recipient_payment_method: 'cash',
        needs_change: true,
      },
    ]);

    // Verificación delivery_request_drop_contacts: datos privados por entrega
    expect(insertedDropContacts).toEqual([
      {
        drop_id: createdDropId,
        dropoff_address: 'San Martín 450',
        dropoff_lat: -27.435,
        dropoff_lng: -65.615,
        recipient_name: 'Juan Pérez',
        recipient_phone: '3815551234',
        recipient_consent_declared: true,
        cash_change_amount: 5000,
        notes: 'Tocar timbre blanco',
      },
    ]);
  });

  it('crea solicitud exitosa con 3 drops y mapea por position sin asumir orden de retorno', async () => {
    let insertedDropsPayload: unknown = null;
    let insertedDropContactsPayload: unknown = null;
    const drop1Id = '11111111-drop-1111-1111-111111111111';
    const drop2Id = '22222222-drop-2222-2222-222222222222';
    const drop3Id = '33333333-drop-3333-3333-333333333333';
    const mockRpc = vi.fn().mockResolvedValue(publishedRpcResponse(createdRequestId, 3));

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
      if (table === 'delivery_requests') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: createdRequestId },
              error: null,
            }),
          }),
        };
      }
      if (table === 'delivery_request_contacts') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'delivery_request_drops') {
        return {
          insert: vi.fn().mockImplementation((payload) => {
            insertedDropsPayload = payload;
            return {
              select: vi.fn().mockResolvedValue({
                // Retorno DESORDENADO para verificar que el mapeo usa position y no índice
                data: [
                  { id: drop2Id, position: 2 },
                  { id: drop3Id, position: 3 },
                  { id: drop1Id, position: 1 },
                ],
                error: null,
              }),
            };
          }),
        };
      }
      if (table === 'delivery_request_drop_contacts') {
        return {
          insert: vi.fn().mockImplementation((payload) => {
            insertedDropContactsPayload = payload;
            return Promise.resolve({ error: null });
          }),
        };
      }
      return {};
    });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'usr-merchant-1', email: 'merchant@test.com' } },
          error: null,
        }),
      },
      from: mockFrom,
      rpc: mockRpc,
    } as unknown as MockedServerClient);

    const inputWith3Drops = {
      ...validFormInput,
      fixedPriceArs: 2000,
      autoAssign: true,
      drops: [validDrop1, validDrop2, validDrop3],
    };

    const result = await createDeliveryRequestAction(inputWith3Drops);
    expect(result.ok).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('publish_request', { p_request_id: createdRequestId });

    // Verificación de drops insertados
    const drops = insertedDropsPayload as Array<{ position: number; request_id: string }>;
    expect(drops).toHaveLength(3);
    expect(drops[0]?.position).toBe(1);
    expect(drops[1]?.position).toBe(2);
    expect(drops[2]?.position).toBe(3);

    // Verificación de mapeo de drop contacts: cada contacto tiene el drop_id correcto de su posición
    const contacts = insertedDropContactsPayload as Array<{
      drop_id: string;
      recipient_name: string;
      cash_change_amount: number | null;
      notes: string | null;
    }>;
    expect(contacts).toHaveLength(3);
    expect(contacts[0]?.drop_id).toBe(drop1Id);
    expect(contacts[0]?.recipient_name).toBe('Juan Pérez');
    expect(contacts[0]?.cash_change_amount).toBe(5000);
    expect(contacts[0]?.notes).toBe('Tocar timbre blanco');

    expect(contacts[1]?.drop_id).toBe(drop2Id);
    expect(contacts[1]?.recipient_name).toBe('María López');
    expect(contacts[1]?.cash_change_amount).toBeNull();
    expect(contacts[1]?.notes).toBe('Piso 2 Depto B');

    expect(contacts[2]?.drop_id).toBe(drop3Id);
    expect(contacts[2]?.recipient_name).toBe('Carlos Gómez');
    expect(contacts[2]?.cash_change_amount).toBeNull();
    expect(contacts[2]?.notes).toBe('Dejar en recepción');
  });

  describe('propagación de errores y casos de fallo', () => {
    it('propaga errores de dominio desde publish_request', async () => {
      const mockRpc = vi.fn().mockResolvedValue(rejectedRpcResponse('DROP_LIMIT_EXCEEDED'));

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'merchant' }, error: null }),
          };
        }
        if (table === 'delivery_requests') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { id: createdRequestId }, error: null }),
            }),
          };
        }
        if (table === 'delivery_request_contacts') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        if (table === 'delivery_request_drops') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({
                data: [{ id: 'drop-1', position: 1 }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'delivery_request_drop_contacts') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'usr-merchant-1', email: 'merchant@test.com' } },
            error: null,
          }),
        },
        from: mockFrom,
        rpc: mockRpc,
      } as unknown as MockedServerClient);

      const result = await createDeliveryRequestAction(validFormInput);
      expect(result).toEqual({ ok: false, code: 'DROP_LIMIT_EXCEEDED' });
    });

    it('devuelve INTERNAL_ERROR si falla la inserción en delivery_request_drops', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'merchant' }, error: null }),
          };
        }
        if (table === 'delivery_requests') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { id: createdRequestId }, error: null }),
            }),
          };
        }
        if (table === 'delivery_request_contacts') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        if (table === 'delivery_request_drops') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'db error' },
              }),
            }),
          };
        }
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'usr-merchant-1', email: 'merchant@test.com' } },
            error: null,
          }),
        },
        from: mockFrom,
      } as unknown as MockedServerClient);

      const result = await createDeliveryRequestAction(validFormInput);
      expect(result).toEqual({ ok: false, code: 'INTERNAL_ERROR' });
    });

    it('devuelve INTERNAL_ERROR si falla la inserción en delivery_request_drop_contacts', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'merchant' }, error: null }),
          };
        }
        if (table === 'delivery_requests') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { id: createdRequestId }, error: null }),
            }),
          };
        }
        if (table === 'delivery_request_contacts') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        if (table === 'delivery_request_drops') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({
                data: [{ id: 'drop-1', position: 1 }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'delivery_request_drop_contacts') {
          return {
            insert: vi.fn().mockResolvedValue({ error: { message: 'db error' } }),
          };
        }
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'usr-merchant-1', email: 'merchant@test.com' } },
            error: null,
          }),
        },
        from: mockFrom,
      } as unknown as MockedServerClient);

      const result = await createDeliveryRequestAction(validFormInput);
      expect(result).toEqual({ ok: false, code: 'INTERNAL_ERROR' });
    });

    it('respeta y propaga requestId estable cuando es provisto en el payload (CC-024 / Decisión B)', async () => {
      const stableRequestId = 'a0000000-0000-4000-8000-000000000001';
      let insertedPayload: Record<string, unknown> | undefined;

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'merchant' }, error: null }),
          };
        }
        if (table === 'delivery_requests') {
          return {
            insert: vi.fn().mockImplementation((payload) => {
              insertedPayload = payload;
              return {
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { id: stableRequestId }, error: null }),
              };
            }),
          };
        }
        if (table === 'delivery_request_contacts') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        if (table === 'delivery_request_drops') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockResolvedValue({
                data: [{ id: 'drop-1', position: 1 }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'delivery_request_drop_contacts') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'usr-merchant-1', email: 'merchant@test.com' } },
            error: null,
          }),
        },
        from: mockFrom,
        rpc: vi.fn().mockResolvedValue(publishedRpcResponse(stableRequestId, 1)),
      } as unknown as MockedServerClient);

      const result = await createDeliveryRequestAction({
        ...validFormInput,
        requestId: stableRequestId,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.requestId).toBe(stableRequestId);
      }
      expect(insertedPayload?.id).toBe(stableRequestId);
    });

    it('rechaza requestId que no sea un UUID válido con VALIDATION_ERROR', async () => {
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'merchant' }, error: null }),
          };
        }
        return {};
      });

      vi.mocked(serverSupabase.createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'usr-merchant-1', email: 'merchant@test.com' } },
            error: null,
          }),
        },
        from: mockFrom,
      } as unknown as MockedServerClient);

      const result = await createDeliveryRequestAction({
        ...validFormInput,
        requestId: 'not-a-valid-uuid',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
      }
    });
  });
});
