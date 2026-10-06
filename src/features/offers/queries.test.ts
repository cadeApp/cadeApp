import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import { getAvailableRequests, getCourierStatusAndAvailability, getMyOffers } from './queries';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('T-114 DoD: queries de ofertas y feed (D3/D15 Privacidad sin coordenadas)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validCourierUser = { id: 'courier-uuid-1', email: 'courier@test.com' };

  it('DoD D3/D15: getAvailableRequests NO devuelve coordenadas ni datos de contacto en la red', async () => {
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
      if (table === 'couriers') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { status: 'approved', available: true },
            error: null,
          }),
        };
      }
      if (table === 'delivery_requests') {
        const data = [
          {
            id: 'req-1',
            approx_distance_m: 2500,
            package_type: 'small',
            recipient_payment_method: 'cash',
            needs_change: true,
            cash_change_amount: 5000,
            notes: 'Frágil',
            published_at: '2026-09-23T18:00:00.000Z',
            expires_at: '2026-09-23T18:30:00.000Z',
            pickup_zone: { name: 'Centro' },
            dropoff_zone: { name: 'Barrio Norte' },
          },
        ];
        const builder = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) =>
            resolve({
              data,
              error: null,
            }),
        };
        return builder;
      }
      if (table === 'offers') {
        const builder = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) =>
            resolve({
              data: [],
              error: null,
            }),
        };
        return builder;
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

    const result = await getAvailableRequests();
    expect(result.requests).toHaveLength(1);
    expect(result.nextCursor).toBeNull();

    const first = result.requests[0];
    expect(first).toBeDefined();
    if (!first) {
      throw new Error('First request should be defined');
    }

    // Datos permitidos presentes
    expect(first.pickupZoneName).toBe('Centro');
    expect(first.dropoffZoneName).toBe('Barrio Norte');
    expect(first.needsChange).toBe(true);

    // Verificación estricta DoD: NINGÚN campo de coordenadas ni contactos en el objeto resultante
    const serialized = JSON.stringify(first);
    expect(serialized).not.toContain('lat');
    expect(serialized).not.toContain('lng');
    expect(serialized).not.toContain('pickup_lat');
    expect(serialized).not.toContain('dropoff_lat');
    expect(serialized).not.toContain('recipient_name');
    expect(serialized).not.toContain('recipient_phone');
    expect(serialized).not.toContain('pickup_address');
    expect(serialized).not.toContain('dropoff_address');
  });

  it('T-342 D3: el feed no selecciona ni transporta indicaciones ni monto exacto de cambio antes del match', async () => {
    let selectProjection = '';
    const row = {
      id: 'req-1',
      created_at: '2026-09-23T18:00:00.000Z',
      approx_distance_m: 2500,
      package_type: 'small',
      recipient_payment_method: 'cash',
      needs_change: true,
      cash_change_amount: 5000,
      notes: 'Portón negro, tocar timbre 2B',
      published_at: '2026-09-23T18:00:00.000Z',
      expires_at: null,
      pickup_zone: { name: 'Centro' },
      dropoff_zone: { name: 'Barrio Norte' },
    };

    const requestsBuilder = {
      select: vi.fn((projection: string) => {
        selectProjection = projection;
        return requestsBuilder;
      }),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: (resolve: (val: unknown) => void) => resolve({ data: [row], error: null }),
    };
    const offersBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      then: (resolve: (val: unknown) => void) => resolve({ data: [], error: null }),
    };

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: validCourierUser },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'delivery_requests') return requestsBuilder;
        if (table === 'offers') return offersBuilder;
        return {};
      }),
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

    const result = await getAvailableRequests();

    const columns = selectProjection.split(/[\s,]+/).filter(Boolean);
    expect(columns).not.toContain('notes');
    expect(columns).not.toContain('cash_change_amount');

    const first = result.requests[0];
    if (!first) throw new Error('First request should be defined');
    expect(first).not.toHaveProperty('notes');
    expect(first).not.toHaveProperty('cashChangeAmount');
    expect(first.recipientPaymentMethod).toBe('cash');
    expect(first.needsChange).toBe(true);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('Portón negro');
    expect(serialized).not.toContain('5000');
  });

  it('pagina más de 50 filas retornando 50 ítems y nextCursor con createdAt y id de la fila 50', async () => {
    const fiftyOneRows = Array.from({ length: 51 }, (_, i) => ({
      id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
      created_at: `2026-09-26T12:${String(59 - i).padStart(2, '0')}:00.000Z`,
      approx_distance_m: 1000,
      package_type: 'small',
      recipient_payment_method: 'cash',
      needs_change: false,
      cash_change_amount: null,
      notes: null,
      published_at: '2026-09-26T12:00:00.000Z',
      expires_at: null,
      pickup_zone: { name: 'Centro' },
      dropoff_zone: { name: 'Aguilares' },
    }));

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'delivery_requests') {
        const builder = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) =>
            resolve({
              data: fiftyOneRows,
              error: null,
            }),
        };
        return builder;
      }
      if (table === 'offers') {
        const builder = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) =>
            resolve({
              data: [],
              error: null,
            }),
        };
        return builder;
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

    const result = await getAvailableRequests();
    expect(result.requests).toHaveLength(50);
    const targetRow = fiftyOneRows[49];
    expect(result.nextCursor).toEqual(
      targetRow ? { createdAt: targetRow.created_at, id: targetRow.id } : null
    );
  });

  it('getMyOffers desambigua la relación con delivery_requests usando offers_request_id_fkey', async () => {
    let selectProjection = '';

    const offersBuilder = {
      select: vi.fn((projection: string) => {
        selectProjection = projection;
        return offersBuilder;
      }),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (resolve: (val: unknown) => void) =>
        resolve({
          data: [],
          error: null,
        }),
    };

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: validCourierUser },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'offers') {
          return offersBuilder;
        }
        return {};
      }),
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

    const result = await getMyOffers();

    expect(result).toEqual([]);
    expect(selectProjection).toContain('delivery_requests!offers_request_id_fkey');
  });

  it('getCourierStatusAndAvailability obtiene el estado y disponibilidad del repartidor', async () => {
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'couriers') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { status: 'pending', available: false },
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

    const statusInfo = await getCourierStatusAndAvailability();
    expect(statusInfo).toEqual({
      status: 'pending',
      available: false,
    });
  });
});
