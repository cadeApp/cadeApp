import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import * as offersRpc from '@/server/rpc/offers';
import { courierHeartbeatAction, setAvailabilityAction } from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/server/rpc/offers', () => ({
  setAvailabilityRpc: vi.fn(),
}));

describe('T-114 DoD: setAvailabilityAction (Disponibilidad del repartidor)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validCourierUser = { id: 'courier-uuid-1', email: 'courier@test.com' };

  it('rechaza si no hay sesión autenticada con UNAUTHENTICATED', async () => {
    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

    const result = await setAvailabilityAction({ available: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('UNAUTHENTICATED');
    }
  });

  it('rechaza si el usuario no tiene rol courier con UNAUTHORIZED_ACTOR', async () => {
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
          data: { user: validCourierUser },
          error: null,
        }),
      },
      from: mockFrom,
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

    const result = await setAvailabilityAction({ available: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('UNAUTHORIZED_ACTOR');
    }
  });

  it('rechaza datos de entrada inválidos con VALIDATION_ERROR', async () => {
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
          data: { user: validCourierUser },
          error: null,
        }),
      },
      from: mockFrom,
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

    const result = await setAvailabilityAction({ available: 'not-a-boolean' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('VALIDATION_ERROR');
    }
  });

  it('propaga error del RPC como COURIER_NOT_APPROVED si el repartidor está en revisión', async () => {
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

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: validCourierUser },
          error: null,
        }),
      },
      from: mockFrom,
    };

    vi.mocked(serverSupabase.createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
    );

    vi.mocked(offersRpc.setAvailabilityRpc).mockResolvedValue({
      ok: false,
      code: 'COURIER_NOT_APPROVED',
    });

    const result = await setAvailabilityAction({ available: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('COURIER_NOT_APPROVED');
    }
  });

  it('actualiza disponibilidad con éxito y retorna ok con nuevo estado', async () => {
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

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: validCourierUser },
          error: null,
        }),
      },
      from: mockFrom,
    };

    vi.mocked(serverSupabase.createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
    );

    vi.mocked(offersRpc.setAvailabilityRpc).mockResolvedValue({
      ok: true,
      data: {
        courierId: validCourierUser.id,
        available: true,
      },
    });

    const result = await setAvailabilityAction({ available: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.available).toBe(true);
    }
    expect(offersRpc.setAvailabilityRpc).toHaveBeenCalledWith(mockSupabase, { available: true });
  });
});

describe('T-415 / CC-041: courierHeartbeatAction', () => {
  beforeEach(() => vi.clearAllMocks());

  function mockRpc(result: { data: unknown; error: { message: string } | null } | Error) {
    const rpc = result instanceof Error ? vi.fn().mockRejectedValue(result) : vi.fn().mockResolvedValue(result);
    vi.mocked(serverSupabase.createClient).mockResolvedValue({ rpc } as unknown as Awaited<
      ReturnType<typeof serverSupabase.createClient>
    >);
    return rpc;
  }

  it('llama a courier_heartbeat con la sesión y devuelve la hora de la base', async () => {
    const rpc = mockRpc({ data: { lastSeenAt: '2026-10-26T12:00:00.000000Z' }, error: null });
    await expect(courierHeartbeatAction()).resolves.toEqual({
      ok: true,
      data: { lastSeenAt: '2026-10-26T12:00:00.000000Z' },
    });
    expect(rpc).toHaveBeenCalledWith('courier_heartbeat');
  });

  it('mapea los errores del contrato; lo demás es INTERNAL_ERROR', async () => {
    mockRpc({ data: null, error: { message: 'COURIER_NOT_APPROVED' } });
    await expect(courierHeartbeatAction()).resolves.toEqual({ ok: false, code: 'COURIER_NOT_APPROVED' });
    mockRpc({ data: null, error: { message: 'function courier_heartbeat does not exist' } });
    await expect(courierHeartbeatAction()).resolves.toEqual({ ok: false, code: 'INTERNAL_ERROR' });
    mockRpc({ data: { lastSeenAt: 'ayer' }, error: null });
    await expect(courierHeartbeatAction()).resolves.toEqual({ ok: false, code: 'INTERNAL_ERROR' });
    mockRpc(new Error('fetch failed'));
    await expect(courierHeartbeatAction()).resolves.toEqual({ ok: false, code: 'INTERNAL_ERROR' });
  });
});
