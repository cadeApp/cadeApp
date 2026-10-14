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

function publishedRpcResponse(requestId: string, dropsCount = 1, idempotent = false) {
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
      idempotent,
    },
    error: null,
  };
}

function rejectedRpcResponse(code: string) {
  return { data: null, error: { code: 'P0001', message: code } };
}

describe('T-340: createDeliveryRequestAction atómica multi-drop (CC-024 / Gate 4)', () => {
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

  const validRequestId = 'a0000000-0000-4000-8000-000000000101';

  const validFormInput = {
    requestId: validRequestId,
    pickupZoneId: validPickupZoneId,
    pickupAddress: 'Av. Sarmiento 120',
    pickupLat: -27.43,
    pickupLng: -65.61,
    fixedPriceArs: null,
    autoAssign: false,
    drops: [validDrop1],
  };

  it('rechaza si no hay sesión autenticada con UNAUTHENTICATED', async () => {
    const mockRpc = vi.fn();
    const mockFrom = vi.fn();
    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
      from: mockFrom,
      rpc: mockRpc,
    } as unknown as MockedServerClient);

    const result = await createDeliveryRequestAction(validFormInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('UNAUTHENTICATED');
    }
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rechaza si el usuario no tiene rol merchant con UNAUTHORIZED_ACTOR', async () => {
    const mockRpc = vi.fn();
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
      rpc: mockRpc,
    } as unknown as MockedServerClient);

    const result = await createDeliveryRequestAction(validFormInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('UNAUTHORIZED_ACTOR');
    }
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
  });

  it('rechaza input inválido con VALIDATION_ERROR', async () => {
    const mockRpc = vi.fn();
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
      rpc: mockRpc,
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
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
  });

  it('crea solicitud exitosa con 1 drop mediante la RPC atómica create_and_publish_multi_drop', async () => {
    const mockRpc = vi.fn().mockResolvedValue(publishedRpcResponse(validRequestId, 1));
    const mockInsert = vi.fn().mockResolvedValue({ data: { id: validRequestId }, error: null });
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
      if (table === 'delivery_requests') return { insert: mockInsert };
      throw new Error(`Tabla inesperada en el test: ${table}`);
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
      expect(result.data.requestId).toBe(validRequestId);
      expect(result.data.redirectTo).toBe('/merchant/dashboard');
    }

    // Verificación de invocación de RPC atómica única (sin inserts individuales de tablas)
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('create_and_publish_multi_drop', {
      p_payload: expect.objectContaining({
        requestId: validRequestId,
        pickupZoneId: validPickupZoneId,
        pickupAddress: 'Av. Sarmiento 120',
        pickupLat: -27.43,
        pickupLng: -65.61,
        fixedPriceArs: null,
        autoAssign: false,
        drops: [
          expect.objectContaining({
            dropoffZoneId: validDropoffZoneId1,
            dropoffAddress: 'San Martín 450',
            dropoffLat: -27.435,
            dropoffLng: -65.615,
            recipientName: 'Juan Pérez',
            recipientPhone: '3815551234',
            recipientConsentDeclared: true,
            packageType: 'mediano',
            recipientPaymentMethod: 'cash',
            needsChange: true,
            cashChangeAmount: 5000,
            notes: 'Tocar timbre blanco',
          }),
        ],
      }),
    });

    // Se verifica que 'from' solo se usó para chequear el perfil merchant, y el spy de insert nunca fue llamado
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('crea solicitud exitosa con 3 drops llamando a create_and_publish_multi_drop con array completo', async () => {
    const mockRpc = vi.fn().mockResolvedValue(publishedRpcResponse(validRequestId, 3));
    const mockInsert = vi.fn().mockResolvedValue({ data: { id: validRequestId }, error: null });
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
      if (table === 'delivery_requests') return { insert: mockInsert };
      throw new Error(`Tabla inesperada en el test: ${table}`);
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
    if (result.ok) {
      expect(result.data.requestId).toBe(validRequestId);
    }
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('create_and_publish_multi_drop', {
      p_payload: expect.objectContaining({
        requestId: validRequestId,
        fixedPriceArs: 2000,
        autoAssign: true,
        drops: expect.arrayContaining([
          expect.objectContaining({ dropoffAddress: 'San Martín 450' }),
          expect.objectContaining({ dropoffAddress: 'Av. Sarmiento 800' }),
          expect.objectContaining({ dropoffAddress: 'Mitre 210' }),
        ]),
      }),
    });
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  describe('propagación de errores y casos de fallo', () => {
    it('propaga errores de dominio desde create_and_publish_multi_drop', async () => {
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
          return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
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

    it('devuelve INTERNAL_ERROR ante fallo inesperado de la RPC', async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'XX000', message: 'unexpected db exception' },
      });

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'merchant' }, error: null }),
          };
        }
        if (table === 'delivery_requests') {
          return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
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
      expect(result).toEqual({ ok: false, code: 'INTERNAL_ERROR' });
    });

    it('respeta y propaga requestId estable cuando es provisto en el payload (CC-024 / Decisión B)', async () => {
      const stableRequestId = 'a0000000-0000-4000-8000-000000000001';
      const mockRpc = vi.fn().mockResolvedValue(publishedRpcResponse(stableRequestId, 1));

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'merchant' }, error: null }),
          };
        }
        if (table === 'delivery_requests') {
          return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
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

      const result = await createDeliveryRequestAction({
        ...validFormInput,
        requestId: stableRequestId,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.requestId).toBe(stableRequestId);
      }
      expect(mockRpc).toHaveBeenCalledWith('create_and_publish_multi_drop', {
        p_payload: expect.objectContaining({
          requestId: stableRequestId,
        }),
      });
    });

    it('rechaza requestId que no sea un UUID válido con VALIDATION_ERROR y cero llamadas RPC/INSERT', async () => {
      const mockRpc = vi.fn();
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
        rpc: mockRpc,
      } as unknown as MockedServerClient);

      const result = await createDeliveryRequestAction({
        ...validFormInput,
        requestId: 'not-a-valid-uuid',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('VALIDATION_ERROR');
      }
      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith('profiles');
    });

    it('CC-024 rechaza Server Action sin requestId con VALIDATION_ERROR y cero llamadas RPC/INSERT', async () => {
      const mockRpc = vi.fn().mockResolvedValue(publishedRpcResponse(validRequestId, 1));
      const mockInsert = vi.fn().mockResolvedValue({ data: { id: validRequestId }, error: null });
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'merchant' }, error: null }),
          };
        }
        if (table === 'delivery_requests') return { insert: mockInsert };
        throw new Error(`Tabla inesperada en el test: ${table}`);
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

      const inputWithoutId = { ...validFormInput };
      delete (inputWithoutId as { requestId?: string }).requestId;

      const result = await createDeliveryRequestAction(inputWithoutId);

      expect(result).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith('profiles');
    });

    it('maneja respuesta idempotente exitosamente', async () => {
      const stableRequestId = 'a0000000-0000-4000-8000-000000000002';
      // Simula reintento idempotente (idempotent: true)
      const mockRpc = vi.fn().mockResolvedValue(publishedRpcResponse(stableRequestId, 1, true));

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { role: 'merchant' }, error: null }),
          };
        }
        if (table === 'delivery_requests') {
          return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
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

      const result = await createDeliveryRequestAction({
        ...validFormInput,
        requestId: stableRequestId,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.requestId).toBe(stableRequestId);
        expect(result.data.redirectTo).toBe('/merchant/dashboard');
      }
    });
  });
});
