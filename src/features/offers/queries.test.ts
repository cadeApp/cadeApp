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
          order: vi.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) =>
            resolve({
              data: [],
              error: null,
            }),
        };
        return builder;
      }
      if (table === 'delivery_request_drops') {
        const builder = {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) =>
            resolve({
              data: [
                {
                  id: 'drop-1',
                  request_id: 'req-1',
                  position: 1,
                  package_type: 'chico',
                  recipient_payment_method: 'cash',
                  needs_change: true,
                  approx_distance_m: 2500,
                  dropoff_zone: { name: 'Barrio Norte' },
                },
              ],
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
      order: vi.fn().mockReturnThis(),
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
        if (table === 'delivery_request_drops') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            then: (resolve: (val: unknown) => void) =>
              resolve({
                data: [
                  {
                    id: 'drop-1',
                    request_id: 'req-1',
                    position: 1,
                    package_type: 'chico',
                    recipient_payment_method: 'cash',
                    needs_change: true,
                    approx_distance_m: 2500,
                    dropoff_zone: { name: 'Barrio Norte' },
                  },
                ],
                error: null,
              }),
          };
        }
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
      order: vi.fn().mockReturnThis(),
      then: (resolve: (val: unknown) => void) => resolve({ data: [], error: null }),
    };
    const dropsRows = (
      rows as Array<{
        id?: string;
        package_type?: string;
        recipient_payment_method?: string;
        needs_change?: boolean;
        approx_distance_m?: number;
      }>
    ).map((r, i) => ({
      id: `drop-${r.id ?? i}`,
      request_id: r.id ?? `req-${i}`,
      position: 1,
      package_type: r.package_type ?? 'chico',
      recipient_payment_method: r.recipient_payment_method ?? 'cash',
      needs_change: Boolean(r.needs_change),
      approx_distance_m: r.approx_distance_m ?? 1000,
      dropoff_zone: { name: 'Aguilares' },
    }));
    const dropsBuilder = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (resolve: (val: unknown) => void) => resolve({ data: dropsRows, error: null }),
    };
    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: validCourierUser }, error: null }),
      },
      from: vi.fn((table: string) => {
        if (table === 'delivery_requests') return requestsBuilder;
        if (table === 'offers') return offersBuilder;
        if (table === 'delivery_request_drops') return dropsBuilder;
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

  it('T-363: sin approx_distance_m el feed devuelve approxDistanceKm null (no inventa 1,0) y respeta el contrato en vivo', async () => {
    mockFeedRows([
      { ...feedRow(1, 'chico', 'cash'), approx_distance_m: null },
      { ...feedRow(2, 'chico', 'cash'), approx_distance_m: 2500 },
    ]);

    const result = await getAvailableRequests();

    expect(result.requests.map((r) => r.approxDistanceKm)).toEqual([null, '2,5']);
    expect(
      liveFeedResponseSchema.safeParse({ data: result.requests, nextCursor: null }).success
    ).toBe(true);
  });

  it('T-343 / PR275-H01: un tipo de paquete fuera del dominio es un error de lectura, no un feed vacío', async () => {
    mockFeedRows([feedRow(1, 'chico', 'cash'), feedRow(2, 'small', 'cash')]);

    await expect(getAvailableRequests()).rejects.toThrow(/package_type/);
  });

  it('T-343 / PR275-H01: un medio de pago fuera del dominio es un error de lectura, no un feed vacío', async () => {
    mockFeedRows([feedRow(1, 'chico', 'cash'), feedRow(2, 'chico', 'card')]);

    await expect(getAvailableRequests()).rejects.toThrow(/recipient_payment_method/);
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
      const dropsRows = rows.map((r, i) => ({
        id: `drop-${r.id ?? i}`,
        request_id: r.id ?? `req-${i}`,
        position: 1,
        package_type: r.package_type ?? 'chico',
        recipient_payment_method: r.recipient_payment_method ?? 'cash',
        needs_change: Boolean(r.needs_change),
        approx_distance_m: r.approx_distance_m ?? 1000,
        dropoff_zone: { name: 'Aguilares' },
      }));
      vi.mocked(serverSupabase.createClient).mockImplementation(
        async () =>
          ({
            auth: {
              getUser: vi.fn().mockResolvedValue({ data: { user: validCourierUser }, error: null }),
            },
            from: vi.fn((table: string) => {
              if (table === 'delivery_requests') return builder(rows);
              if (table === 'delivery_request_drops') return builder(dropsRows);
              return builder([]);
            }),
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
          order: vi.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) =>
            resolve({
              data: [],
              error: null,
            }),
        };
        return builder;
      }
      if (table === 'delivery_request_drops') {
        const drops51 = fiftyOneRows.map((r) => ({
          id: `drop-${r.id}`,
          request_id: r.id,
          position: 1,
          package_type: 'chico',
          recipient_payment_method: 'cash',
          needs_change: false,
          approx_distance_m: 1000,
          dropoff_zone: { name: 'Aguilares' },
        }));
        const builder = {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) =>
            resolve({
              data: drops51,
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

  it('T-340 / CC-022 §3: getAvailableRequests proyecta múltiples drops con resumen público y sin PII', async () => {
    const reqRow = {
      id: 'req-multi-1',
      created_at: '2026-10-12T10:00:00.000Z',
      approx_distance_m: 3500,
      package_type: 'chico',
      recipient_payment_method: 'cash',
      needs_change: true,
      published_at: '2026-10-12T10:00:00.000Z',
      expires_at: null,
      fixed_price_ars: null,
      auto_assign: false,
      drops_count: 3,
      pickup_zone: { name: 'Centro' },
      dropoff_zone: { name: 'Barrio Norte' },
    };

    const dropRows = [
      {
        request_id: 'req-multi-1',
        position: 1,
        package_type: 'chico',
        recipient_payment_method: 'cash',
        needs_change: true,
        approx_distance_m: 1200,
        dropoff_zone: { name: 'Barrio Norte' },
      },
      {
        request_id: 'req-multi-1',
        position: 2,
        package_type: 'mediano',
        recipient_payment_method: 'transfer',
        needs_change: false,
        approx_distance_m: 1100,
        dropoff_zone: { name: 'Barrio San Martín' },
      },
      {
        request_id: 'req-multi-1',
        position: 3,
        package_type: 'sobre',
        recipient_payment_method: 'cash',
        needs_change: false,
        approx_distance_m: 1200,
        dropoff_zone: { name: 'Centro' },
      },
    ];

    const mockFrom = vi.fn((table: string) => {
      if (table === 'delivery_requests') {
        const builder = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) => resolve({ data: [reqRow], error: null }),
        };
        return builder;
      }
      if (table === 'offers') {
        const builder = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) => resolve({ data: [], error: null }),
        };
        return builder;
      }
      if (table === 'delivery_request_drops') {
        const builder = {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) => resolve({ data: dropRows, error: null }),
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
    const item = result.requests[0];
    if (!item) throw new Error('Expected item in requests');
    expect(item.dropsCount).toBe(3);
    expect(item.drops).toHaveLength(3);
    expect(item.drops?.[0]).toEqual({
      position: 1,
      dropoffZoneName: 'Barrio Norte',
      packageType: 'chico',
      recipientPaymentMethod: 'cash',
      needsChange: true,
      approxDistanceM: 1200,
    });
    expect(item.drops?.[1]).toEqual({
      position: 2,
      dropoffZoneName: 'Barrio San Martín',
      packageType: 'mediano',
      recipientPaymentMethod: 'transfer',
      needsChange: false,
      approxDistanceM: 1100,
    });
    expect(item.drops?.[2]).toEqual({
      position: 3,
      dropoffZoneName: 'Centro',
      packageType: 'sobre',
      recipientPaymentMethod: 'cash',
      needsChange: false,
      approxDistanceM: 1200,
    });

    // Zero PII in serialized result
    const serialized = JSON.stringify(item);
    expect(serialized).not.toContain('recipientName');
    expect(serialized).not.toContain('recipientPhone');
    expect(serialized).not.toContain('dropoffAddress');
    expect(serialized).not.toContain('deliveryNotes');
    expect(serialized).not.toContain('cashChangeAmount');
    expect(serialized).not.toContain('dropoffLat');
    expect(serialized).not.toContain('dropoffLng');
  });

  it('PR318-H05: soporta parent con columnas legacy null y deriva atributos desde primer drop', async () => {
    const reqRow = {
      id: 'req-multi-null-parent',
      approx_distance_m: 3500,
      package_type: null,
      recipient_payment_method: null,
      needs_change: null,
      notes: null,
      cash_change_amount: null,
      published_at: '2026-10-10T12:00:00.000Z',
      expires_at: '2026-10-10T12:30:00.000Z',
      fixed_price_ars: null,
      auto_assign: false,
      drops_count: 2,
      pickup_zone: { name: 'Centro' },
      dropoff_zone: null,
    };

    const dropRows = [
      {
        id: 'drop-1',
        request_id: 'req-multi-null-parent',
        position: 1,
        approx_distance_m: 1500,
        package_type: 'mediano',
        recipient_payment_method: 'transfer',
        needs_change: false,
        dropoff_zone: { name: 'Barrio Norte' },
      },
      {
        id: 'drop-2',
        request_id: 'req-multi-null-parent',
        position: 2,
        approx_distance_m: 2000,
        package_type: 'grande',
        recipient_payment_method: 'cash',
        needs_change: true,
        dropoff_zone: { name: 'Barrio Sur' },
      },
    ];

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
        const builder = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) => resolve({ data: [reqRow], error: null }),
        };
        return builder;
      }
      if (table === 'offers') {
        const builder = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) => resolve({ data: [], error: null }),
        };
        return builder;
      }
      if (table === 'delivery_request_drops') {
        const builder = {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) => resolve({ data: dropRows, error: null }),
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
    const item = result.requests[0];
    expect(item?.packageType).toBe('mediano');
    expect(item?.recipientPaymentMethod).toBe('transfer');
    expect(item?.needsChange).toBe(false);
    expect(item?.dropoffZoneName).toBe('Barrio Norte');
    expect(item?.dropsCount).toBe(2);
    expect(item?.drops).toHaveLength(2);
  });

  it('PR318-H05: falla cerrado si drops_count > 1 pero delivery_request_drops devuelve vacío', async () => {
    const reqRow = {
      id: 'req-multi-orphan',
      approx_distance_m: 3500,
      package_type: 'chico',
      recipient_payment_method: 'cash',
      needs_change: false,
      notes: null,
      cash_change_amount: null,
      published_at: '2026-10-10T12:00:00.000Z',
      expires_at: '2026-10-10T12:30:00.000Z',
      fixed_price_ars: null,
      auto_assign: false,
      drops_count: 2,
      pickup_zone: { name: 'Centro' },
      dropoff_zone: { name: 'Barrio Norte' },
    };

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
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) => resolve({ data: [reqRow], error: null }),
        };
      }
      if (table === 'offers') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) => resolve({ data: [], error: null }),
        };
      }
      if (table === 'delivery_request_drops') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) => resolve({ data: [], error: null }),
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

    await expect(getAvailableRequests()).rejects.toThrow(
      'Inconsistencia en solicitud req-multi-orphan: drops_count=2 pero no se encontraron entregas'
    );
  });

  it('PR318-H05: falla cerrado si drops_count = 1 pero delivery_request_drops devuelve vacío', async () => {
    const reqRow = {
      id: 'req-single-orphan',
      approx_distance_m: 2500,
      package_type: 'chico',
      recipient_payment_method: 'cash',
      needs_change: false,
      notes: null,
      cash_change_amount: null,
      published_at: '2026-10-10T12:00:00.000Z',
      expires_at: '2026-10-10T12:30:00.000Z',
      fixed_price_ars: null,
      auto_assign: false,
      drops_count: 1,
      pickup_zone: { name: 'Centro' },
      dropoff_zone: { name: 'Barrio Norte' },
    };

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
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) => resolve({ data: [reqRow], error: null }),
        };
      }
      if (table === 'offers') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) => resolve({ data: [], error: null }),
        };
      }
      if (table === 'delivery_request_drops') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          then: (resolve: (val: unknown) => void) => resolve({ data: [], error: null }),
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

    await expect(getAvailableRequests()).rejects.toThrow(
      'Inconsistencia en solicitud req-single-orphan: drops_count=1 pero no se encontraron entregas'
    );
  });
});

describe('T-379: getMyOffers devuelve el estado de la solicitud', () => {
  function rawOffer(id: string, status: string, request: { status: string } | null) {
    return {
      id,
      request_id: `req-${id}`,
      amount_ars: 1500,
      eta_minutes: 15,
      message: null,
      status,
      created_at: '2026-10-20T10:00:00Z',
      decided_at: null,
      delivery_requests: request
        ? {
            status: request.status,
            expires_at: null,
            approx_distance_m: 2500,
            pickup_zone: { name: 'Centro' },
            dropoff_zone: { name: 'Barrio Norte' },
          }
        : null,
    };
  }

  function mockOffers(rows: unknown[]) {
    let projection = '';
    const builder = {
      select: vi.fn((value: string) => {
        projection = value;
        return builder;
      }),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (resolve: (val: unknown) => void) => resolve({ data: rows, error: null }),
    };
    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'courier-1' } }, error: null }),
      },
      from: vi.fn((table: string) => (table === 'offers' ? builder : {})),
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);
    return () => projection;
  }

  it('lee delivery_requests.status en el mismo select y lo devuelve por oferta aceptada', async () => {
    const projection = mockOffers([
      rawOffer('matched', 'accepted', { status: 'matched' }),
      rawOffer('transit', 'accepted', { status: 'in_transit' }),
      rawOffer('delivered', 'accepted', { status: 'delivered' }),
      rawOffer('cancelled', 'accepted', { status: 'cancelled' }),
      rawOffer('hidden', 'accepted', null),
    ]);

    const result = await getMyOffers();

    expect(projection()).toMatch(/delivery_requests!offers_request_id_fkey\s*\(\s*status,/);
    expect(result.map((offer) => [offer.offerId, offer.status, offer.requestStatus])).toEqual([
      ['matched', 'accepted', 'matched'],
      ['transit', 'accepted', 'in_transit'],
      ['delivered', 'accepted', 'delivered'],
      ['cancelled', 'accepted', 'cancelled'],
      ['hidden', 'accepted', null],
    ]);
  });

  it('cubre los seis valores de offer_status, incluidos expired y cancelled', async () => {
    mockOffers(
      ['pending', 'accepted', 'rejected', 'withdrawn', 'expired', 'cancelled'].map((status) =>
        rawOffer(status, status, { status: 'published' })
      )
    );

    const result = await getMyOffers();

    expect(result.map((offer) => offer.status)).toEqual([
      'pending',
      'accepted',
      'rejected',
      'withdrawn',
      'expired',
      'cancelled',
    ]);
  });
});
