import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import { getActiveZones } from './queries';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('T-111: Merchant queries (zonas activas)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('obtiene la lista de zonas activas ordenadas por nombre', async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: [
        { id: 'zone-1', name: 'Barrio Norte' },
        { id: 'zone-2', name: 'Centro' },
      ],
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);

    const zones = await getActiveZones();
    expect(zones).toHaveLength(2);
    expect(zones[0]?.name).toBe('Barrio Norte');
    expect(zones[1]?.name).toBe('Centro');
    expect(mockFrom).toHaveBeenCalledWith('zones');
    expect(mockEq).toHaveBeenCalledWith('active', true);
  });

  it('retorna array vacío ante error de consulta', async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database query error' },
    });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof serverSupabase.createClient> extends Promise<infer T>
      ? T
      : never);

    const zones = await getActiveZones();
    expect(zones).toEqual([]);
  });
});
