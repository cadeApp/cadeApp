import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import { getOnlineCouriersLiveServer } from './online-couriers';

vi.mock('server-only', () => ({}));
vi.mock('@/server/supabase/server', () => ({ createClient: vi.fn() }));

function mockRpc(result: { data: unknown; error: { message: string } | null } | Error) {
  const rpc = result instanceof Error ? vi.fn().mockRejectedValue(result) : vi.fn().mockResolvedValue(result);
  vi.mocked(serverSupabase.createClient).mockResolvedValue({ rpc } as unknown as Awaited<
    ReturnType<typeof serverSupabase.createClient>
  >);
  return rpc;
}

describe('T-415 / CC-041: getOnlineCouriersLiveServer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('llama a get_online_couriers_count con la sesión y valida la respuesta', async () => {
    const rpc = mockRpc({ data: { count: 3, windowMinutes: 10 }, error: null });
    await expect(getOnlineCouriersLiveServer()).resolves.toEqual({ ok: true, data: { count: 3, windowMinutes: 10 } });
    expect(rpc).toHaveBeenCalledWith('get_online_couriers_count');
  });

  it('sin sesión es 401; con otro rol, 403; lo demás, 500', async () => {
    mockRpc({ data: null, error: { message: 'UNAUTHENTICATED' } });
    await expect(getOnlineCouriersLiveServer()).resolves.toEqual({ ok: false, error: 'UNAUTHENTICATED', status: 401 });
    mockRpc({ data: null, error: { message: 'UNAUTHORIZED_ACTOR' } });
    await expect(getOnlineCouriersLiveServer()).resolves.toEqual({ ok: false, error: 'UNAUTHORIZED_ACTOR', status: 403 });
    mockRpc({ data: null, error: { message: 'relation does not exist' } });
    await expect(getOnlineCouriersLiveServer()).resolves.toEqual({ ok: false, error: 'DATABASE_ERROR', status: 500 });
    mockRpc({ data: { count: 3, windowMinutes: 10, couriers: [] }, error: null });
    await expect(getOnlineCouriersLiveServer()).resolves.toEqual({ ok: false, error: 'DATABASE_ERROR', status: 500 });
    mockRpc(new Error('fetch failed'));
    await expect(getOnlineCouriersLiveServer()).resolves.toEqual({ ok: false, error: 'DATABASE_ERROR', status: 500 });
  });
});
