import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useActiveTrips } from './use-active-trips';
import { offerKeys } from '../query-keys';
import * as actions from '../actions';
import * as browserClient from '@/lib/supabase/browser';
import type { ActiveTripSummary } from '../schemas';

vi.mock('../actions', () => ({
  readActiveTripsAction: vi.fn(),
}));

describe('T-360 — useActiveTrips: hook de viajes activos del repartidor', () => {
  let queryClient: QueryClient;
  let mockSubscribe: ReturnType<typeof vi.fn>;
  let mockOn: ReturnType<typeof vi.fn>;
  let mockChannel: { on: typeof mockOn; subscribe: typeof mockSubscribe };
  let subscribedTables: string[];
  const callbacksByTable = new Map<string, (payload: unknown) => void>();
  let subscribeStatusCallback: ((status: string) => void) | null = null;

  const courierId = '00000000-0000-4000-8000-0000000008c1';

  const sampleTrip: ActiveTripSummary = {
    id: 'req-active-1',
    status: 'matched',
    pickupZoneName: 'Centro',
    dropoffZoneName: 'Barrio Sur',
    dropsCount: 1,
    amountArs: 2200,
    matchedAt: '2026-10-15T12:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    subscribedTables = [];
    callbacksByTable.clear();
    subscribeStatusCallback = null;

    mockSubscribe = vi.fn().mockImplementation((cb) => {
      if (typeof cb === 'function') {
        subscribeStatusCallback = cb;
        cb('SUBSCRIBED');
      }
      return mockChannel;
    });
    mockOn = vi.fn().mockImplementation((_event, filterObj, cb) => {
      if (filterObj?.table) {
        subscribedTables.push(filterObj.table);
        if (typeof cb === 'function') {
          callbacksByTable.set(filterObj.table, cb);
        }
      }
      return mockChannel;
    });
    mockChannel = {
      on: mockOn,
      subscribe: mockSubscribe,
    };

    vi.spyOn(browserClient, 'createClient').mockReturnValue({
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn(),
    } as unknown as ReturnType<typeof browserClient.createClient>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  it('inicia con initialTrips SSR y refresca exitosamente llamando readActiveTripsAction', async () => {
    vi.mocked(actions.readActiveTripsAction).mockResolvedValue({
      courierId,
      trips: [sampleTrip],
    });

    const { result } = renderHook(
      () =>
        useActiveTrips({
          courierId,
          initialTrips: [sampleTrip],
          courierStatus: 'approved',
        }),
      { wrapper }
    );

    expect(result.current.trips).toHaveLength(1);
    expect(result.current.trips[0]).toEqual(sampleTrip);
    expect(result.current.isError).toBe(false);
  });

  it('refetch retorna [] tras cancelación o entrega y no persiste la tarjeta en caché', async () => {
    vi.mocked(actions.readActiveTripsAction)
      .mockResolvedValueOnce({
        courierId,
        trips: [sampleTrip],
      })
      .mockResolvedValueOnce({
        courierId,
        trips: [], // viaje cancelado o entregado
      });

    const { result } = renderHook(
      () =>
        useActiveTrips({
          courierId,
          initialTrips: [sampleTrip],
          courierStatus: 'approved',
        }),
      { wrapper }
    );

    expect(result.current.trips).toHaveLength(1);

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.trips).toEqual([]);
    });
  });

  it('aislamiento de sesión: la caché de courier B rechaza datos retornados de courier A', async () => {
    // La acción devuelve datos de courier-A por desfasaje de sesión
    vi.mocked(actions.readActiveTripsAction).mockResolvedValue({
      courierId: 'courier-A',
      trips: [sampleTrip],
    });

    const { result } = renderHook(
      () =>
        useActiveTrips({
          courierId: 'courier-B',
          initialTrips: [],
          courierStatus: 'approved',
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error?.message).toContain('Sesión no coincide');
    });

    // En error no se interpretan datos cruzados
    expect(result.current.trips).toEqual([]);
  });

  it('el hook permanece activo e invoca la consulta aun cuando available no esté activo', async () => {
    vi.mocked(actions.readActiveTripsAction).mockResolvedValue({
      courierId,
      trips: [sampleTrip],
    });

    const { result } = renderHook(
      () =>
        useActiveTrips({
          courierId,
          initialTrips: [],
          courierStatus: 'approved',
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(actions.readActiveTripsAction).toHaveBeenCalled();
      expect(result.current.trips).toHaveLength(1);
    });
  });

  it('deshabilita la consulta si courierStatus no es approved (ej. pending)', async () => {
    vi.mocked(actions.readActiveTripsAction).mockResolvedValue({
      courierId,
      trips: [sampleTrip],
    });

    const { result } = renderHook(
      () =>
        useActiveTrips({
          courierId,
          initialTrips: [],
          courierStatus: 'pending',
        }),
      { wrapper }
    );

    expect(actions.readActiveTripsAction).not.toHaveBeenCalled();
    expect(result.current.trips).toEqual([]);
  });

  it('suscripción Realtime incluye delivery_requests y offers sin filtro status=eq.published', async () => {
    vi.mocked(actions.readActiveTripsAction).mockResolvedValue({
      courierId,
      trips: [],
    });

    renderHook(
      () =>
        useActiveTrips({
          courierId,
          initialTrips: [],
          courierStatus: 'approved',
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(mockOn).toHaveBeenCalled();
    });

    // Verificar que ambas tablas están suscritas
    expect(subscribedTables).toContain('delivery_requests');
    expect(subscribedTables).toContain('offers');

    // Verificar que ninguna suscripción tenga filtro status=eq.published
    for (const call of mockOn.mock.calls) {
      const filterObj = call[1];
      if (filterObj?.table === 'delivery_requests') {
        expect(filterObj.filter).toBeUndefined();
      }
    }
  });

  it('los errores de la acción ponen isError=true y no se interpretan como un cero silencioso', async () => {
    vi.mocked(actions.readActiveTripsAction).mockRejectedValue(
      new Error('Error al cargar viajes activos')
    );

    const { result } = renderHook(
      () =>
        useActiveTrips({
          courierId,
          initialTrips: [],
          courierStatus: 'approved',
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBeDefined();
    });
  });

  it('evento Realtime en delivery_requests invoca refetch y actualiza viajes sin mutar caché manualmente', async () => {
    vi.mocked(actions.readActiveTripsAction).mockResolvedValue({
      courierId,
      trips: [sampleTrip],
    });

    const { result } = renderHook(
      () =>
        useActiveTrips({
          courierId,
          initialTrips: [sampleTrip],
          courierStatus: 'approved',
        }),
      { wrapper }
    );

    // Esperar a que el canal se suscriba y registre los callbacks
    await waitFor(() => {
      expect(callbacksByTable.has('delivery_requests')).toBe(true);
    });

    // Simular que el viaje se cancela o finaliza en DB
    vi.mocked(actions.readActiveTripsAction).mockResolvedValue({
      courierId,
      trips: [],
    });

    const deliveryRequestsCb = callbacksByTable.get('delivery_requests');
    expect(deliveryRequestsCb).toBeDefined();

    // Invocar el callback real de Postgres Changes
    await act(async () => {
      deliveryRequestsCb?.({
        eventType: 'UPDATE',
        new: { id: sampleTrip.id, status: 'cancelled' },
      });
    });

    // useRealtimeInvalidation tiene debounce de 300ms; waitFor espera el refetch real
    await waitFor(
      () => {
        expect(result.current.trips).toEqual([]);
      },
      { timeout: 2000 }
    );

    expect(actions.readActiveTripsAction).toHaveBeenCalledTimes(2);
  });

  it('evento Realtime en offers invoca refetch y actualiza viajes cuando cambia la oferta', async () => {
    vi.mocked(actions.readActiveTripsAction).mockResolvedValue({
      courierId,
      trips: [sampleTrip],
    });

    const { result } = renderHook(
      () =>
        useActiveTrips({
          courierId,
          initialTrips: [sampleTrip],
          courierStatus: 'approved',
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(callbacksByTable.has('offers')).toBe(true);
    });

    const updatedTrip: ActiveTripSummary = {
      ...sampleTrip,
      amountArs: 3500,
    };
    vi.mocked(actions.readActiveTripsAction).mockResolvedValue({
      courierId,
      trips: [updatedTrip],
    });

    const offersCb = callbacksByTable.get('offers');
    expect(offersCb).toBeDefined();

    await act(async () => {
      offersCb?.({
        eventType: 'UPDATE',
        new: { id: 'offer-1', amount_ars: 3500 },
      });
    });

    await waitFor(
      () => {
        expect(result.current.trips[0]?.amountArs).toBe(3500);
      },
      { timeout: 2000 }
    );

    expect(actions.readActiveTripsAction).toHaveBeenCalledTimes(2);
  });

  it('evento Realtime actualiza transición de estado de matched a in_transit', async () => {
    vi.mocked(actions.readActiveTripsAction).mockResolvedValue({
      courierId,
      trips: [sampleTrip],
    });

    const { result } = renderHook(
      () =>
        useActiveTrips({
          courierId,
          initialTrips: [sampleTrip],
          courierStatus: 'approved',
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(callbacksByTable.has('delivery_requests')).toBe(true);
    });

    const inTransitTrip: ActiveTripSummary = {
      ...sampleTrip,
      status: 'in_transit',
    };
    vi.mocked(actions.readActiveTripsAction).mockResolvedValue({
      courierId,
      trips: [inTransitTrip],
    });

    const deliveryRequestsCb = callbacksByTable.get('delivery_requests');
    expect(deliveryRequestsCb).toBeDefined();

    await act(async () => {
      deliveryRequestsCb?.({
        eventType: 'UPDATE',
        new: { id: sampleTrip.id, status: 'in_transit' },
      });
    });

    await waitFor(
      () => {
        expect(result.current.trips[0]?.status).toBe('in_transit');
      },
      { timeout: 2000 }
    );
  });

  it('resuscripción SUBSCRIBED tras reconexión invalida la consulta automáticamente', async () => {
    vi.mocked(actions.readActiveTripsAction).mockResolvedValue({
      courierId,
      trips: [sampleTrip],
    });

    const { result } = renderHook(
      () =>
        useActiveTrips({
          courierId,
          initialTrips: [sampleTrip],
          courierStatus: 'approved',
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(subscribeStatusCallback).not.toBeNull();
    });

    const initialCalls = vi.mocked(actions.readActiveTripsAction).mock.calls.length;

    // Simular reconexión del canal pasando a SUBSCRIBED
    await act(async () => {
      subscribeStatusCallback?.('SUBSCRIBED');
    });

    await waitFor(() => {
      expect(vi.mocked(actions.readActiveTripsAction).mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });
});
