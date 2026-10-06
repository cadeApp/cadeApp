import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import { getAvailableRequests, getCourierStatusAndAvailability, getMyOffers } from './queries';
import { liveFeedResponseSchema } from '@/lib/live-contracts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getAvailableRequestsLiveServer } from '@/server/live/t204';
import { RequestCard } from './components/request-card';

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
            package_type: 'chico',
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
      package_type: 'chico',
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

  function mockFeedRows(rows: readonly unknown[]) {
    const requestsBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: (resolve: (val: unknown) => void) => resolve({ data: rows, error: null }),
    };
    const offersBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      then: (resolve: (val: unknown) => void) => resolve({ data: [], error: null }),
    };
    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: validCourierUser }, error: null }),
      },
      from: vi.fn((table: string) => {
        if (table === 'delivery_requests') return requestsBuilder;
        if (table === 'offers') return offersBuilder;
        return {};
      }),
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);
  }

  function feedRow(i: number, packageType: string, method: string) {
    return {
      id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
      created_at: '2026-09-26T12:00:00.000Z',
      approx_distance_m: 1000,
      package_type: packageType,
      recipient_payment_method: method,
      needs_change: false,
      published_at: '2026-09-26T12:00:00.000Z',
      expires_at: null,
      pickup_zone: { name: 'Centro' },
      dropoff_zone: { name: 'Aguilares' },
    };
  }

  it('T-343: el feed SSR conserva los valores reales de la base y pasa el contrato del feed en vivo', async () => {
    const combos = (['sobre', 'chico', 'mediano', 'grande'] as const).flatMap((packageType) =>
      (['cash', 'transfer', 'to_agree'] as const).map((method) => [packageType, method] as const)
    );
    mockFeedRows(combos.map(([packageType, method], i) => feedRow(i + 1, packageType, method)));

    const result = await getAvailableRequests();

    expect(result.requests.map((r) => [r.packageType, r.recipientPaymentMethod])).toEqual(combos);
    expect(
      liveFeedResponseSchema.safeParse({ data: result.requests, nextCursor: null }).success
    ).toBe(true);
  });

  it('T-343: un valor fuera del dominio canónico no se fuerza ni se inventa', async () => {
    mockFeedRows([feedRow(1, 'small', 'cash'), feedRow(2, 'chico', 'card')]);

    const result = await getAvailableRequests();

    expect(result.requests).toEqual([]);
  });

  it('T-343: el render inicial (SSR) y el refresco en vivo representan la misma fila de la misma forma', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-26T12:05:00.000Z'));
    try {
      const combos = (['sobre', 'chico', 'mediano', 'grande'] as const).flatMap((packageType) =>
        (['cash', 'transfer', 'to_agree'] as const).map((method) => [packageType, method] as const)
      );
      const rows = combos.map(([packageType, method], i) => feedRow(i + 1, packageType, method));
      const builder = (data: unknown) => {
        const b = {
          select: vi.fn(() => b),
          eq: vi.fn(() => b),
          order: vi.fn(() => b),
          limit: vi.fn(() => b),
          or: vi.fn(() => b),
          in: vi.fn(() => b),
          then: (resolve: (val: unknown) => unknown) =>
            Promise.resolve({ data, error: null }).then(resolve),
        };
        return b;
      };
      vi.mocked(serverSupabase.createClient).mockImplementation(
        async () =>
          ({
            auth: {
              getUser: vi.fn().mockResolvedValue({ data: { user: validCourierUser }, error: null }),
            },
            from: vi.fn((table: string) => builder(table === 'delivery_requests' ? rows : [])),
          }) as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>
      );

      const ssr = await getAvailableRequests();
      const live = await getAvailableRequestsLiveServer();
      expect(live.ok).toBe(true);
      if (!live.ok) return;
      const liveItems = liveFeedResponseSchema.parse(live.data).data;

      expect(ssr.requests).toHaveLength(combos.length);
      expect(liveItems).toEqual(ssr.requests);

      const markup = (request: (typeof ssr.requests)[number]) =>
        renderToStaticMarkup(createElement(RequestCard, { request, onOfferClick: () => {} }));
      ssr.requests.forEach((ssrItem, i) => {
        const liveItem = liveItems[i];
        if (!liveItem) throw new Error('Live item should be defined');
        expect(markup(liveItem)).toBe(markup(ssrItem));
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('pagina más de 50 filas retornando 50 ítems y nextCursor con createdAt y id de la fila 50', async () => {
    const fiftyOneRows = Array.from({ length: 51 }, (_, i) => ({
      id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
      created_at: `2026-09-26T12:${String(59 - i).padStart(2, '0')}:00.000Z`,
      approx_distance_m: 1000,
      package_type: 'chico',
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
