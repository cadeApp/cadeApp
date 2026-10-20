// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MerchantRequestsList } from './merchant-requests-list';
import { MerchantHistoryView } from './merchant-history-view';
import type { MerchantRequestSummary, MerchantMetrics } from '../types';
import { notify } from '@/ui/notify';
import { cancelMerchantRequestAction } from '../actions';
import { MERCHANT_PANEL_MOUNTED_KEY } from '../hooks/use-merchant-panel-refresh';

const mockRefresh = vi.fn();
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

vi.mock('@/ui/notify', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../actions', () => ({
  cancelMerchantRequestAction: vi.fn(),
}));

// T-381: el panel abre un canal de Realtime; acá es un canal inerte (estas pruebas no emiten eventos).
vi.mock('@/lib/supabase/browser', () => {
  const channel = { on: () => channel, subscribe: () => channel };
  return {
    createClient: () => ({
      auth: { getSession: async () => ({ data: { session: null } }) },
      channel: () => channel,
      removeChannel: () => undefined,
    }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  // T-381: cada test arranca como un documento nuevo; el primer montaje del panel no refresca.
  Reflect.deleteProperty(window, MERCHANT_PANEL_MOUNTED_KEY);
});

describe('T-113 / C02: MerchantRequestsList ("Mis solicitudes")', () => {
  const mockMetrics: MerchantMetrics = {
    dispatchedToday: 4,
    avgRateArs: 1850,
    activeCount: 2,
  };

  const mockRequests: MerchantRequestSummary[] = [
    {
      id: 'req-1',
      pickupZoneName: 'Barrio Centro',
      dropoffZoneName: 'Barrio Norte',
      approxDistanceKm: '2,5',
      packageType: 'chico',
      recipientPaymentMethod: 'cash',
      needsChange: true,
      status: 'published',
      expiresAt: '2026-09-24T12:00:00Z',
      createdAt: '2026-09-24T09:30:00Z',
      offersCount: 3,
      acceptedOfferId: null,
    },
    {
      id: 'req-2',
      pickupZoneName: 'San Martín',
      dropoffZoneName: 'Villa Nueva',
      approxDistanceKm: '1,8',
      packageType: 'mediano',
      recipientPaymentMethod: 'transfer',
      needsChange: false,
      status: 'published',
      expiresAt: '2026-09-24T12:30:00Z',
      createdAt: '2026-09-24T10:00:00Z',
      offersCount: 0,
      acceptedOfferId: null,
    },
    {
      id: 'req-3',
      pickupZoneName: 'Centro',
      dropoffZoneName: 'Barrio Colón',
      approxDistanceKm: '3,0',
      packageType: 'grande',
      recipientPaymentMethod: 'cash',
      needsChange: false,
      status: 'matched',
      expiresAt: '2026-09-24T11:00:00Z',
      createdAt: '2026-09-24T08:15:00Z',
      offersCount: 2,
      acceptedOfferId: 'off-matched',
    },
  ];

  it('renderiza métricas C02 con formato ARS y Anti-12px', () => {
    render(<MerchantRequestsList requests={mockRequests} metrics={mockMetrics} />);

    expect(screen.getByText('Despachos hoy')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();

    expect(screen.getByText('Tarifa promedio')).toBeDefined();
    expect(screen.getByText('$ 1.850')).toBeDefined();

    expect(screen.getByText('Solicitudes activas')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
  });

  it('renderiza botón "Nueva solicitud" con enlace a /merchant/requests/new', () => {
    render(<MerchantRequestsList requests={mockRequests} metrics={mockMetrics} />);

    const newRequestLinks = screen.getAllByRole('link', { name: /nueva solicitud/i });
    expect(newRequestLinks.length).toBeGreaterThan(0);
    expect(newRequestLinks[0]?.getAttribute('href')).toBe('/merchant/requests/new');
  });

  it('renderiza listado de solicitudes con badges accesibles de estado', () => {
    render(<MerchantRequestsList requests={mockRequests} metrics={mockMetrics} />);

    // Zonas
    expect(screen.getByText('Barrio Centro')).toBeDefined();
    expect(screen.getByText('Barrio Norte')).toBeDefined();
    expect(screen.getByText('San Martín')).toBeDefined();
    expect(screen.getByText('Villa Nueva')).toBeDefined();

    // Badges de estado accesibles
    expect(screen.getByText('3 ofertas recibidas')).toBeDefined();
    expect(screen.getByText('Esperando ofertas')).toBeDefined();
    expect(screen.getByText('Asignada')).toBeDefined();

    // Enlaces a la pantalla de detalle / ofertas C04
    const offerLinks = screen.getAllByRole('link', { name: /ver ofertas/i });
    expect(offerLinks.length).toBe(2);
    expect(offerLinks[0]?.getAttribute('href')).toBe('/merchant/requests/req-1');
  });

  it('muestra estado vacío amigable cuando no hay solicitudes', () => {
    render(
      <MerchantRequestsList
        requests={[]}
        metrics={{ dispatchedToday: 0, avgRateArs: 0, activeCount: 0 }}
      />
    );

    expect(screen.getByText(/No tenés solicitudes activas/i)).toBeDefined();
    const emptyAction = screen.getByRole('button', { name: /nueva solicitud/i });
    expect(emptyAction).toBeDefined();
  });

  it('muestra EmptyState "No tenés solicitudes activas" si sólo existen solicitudes terminales (PR87-H20)', () => {
    const onlyTerminalRequests: MerchantRequestSummary[] = [
      {
        id: 'req-deliv-only',
        pickupZoneName: 'Zona Terminal Intrusa',
        dropoffZoneName: 'Barrio Sur',
        approxDistanceKm: '1,5',
        packageType: 'chico',
        recipientPaymentMethod: 'cash',
        needsChange: false,
        status: 'delivered',
        expiresAt: null,
        createdAt: '2026-09-24T09:30:00Z',
        offersCount: 1,
        acceptedOfferId: 'off-1',
      },
    ];

    render(
      <MerchantRequestsList
        requests={onlyTerminalRequests}
        metrics={{ dispatchedToday: 1, avgRateArs: 2100, activeCount: 0 }}
      />
    );

    expect(screen.queryByText(/Zona Terminal Intrusa/i)).toBeNull();
    expect(screen.getByText(/No tenés solicitudes activas/i)).toBeDefined();
  });
  describe('T-359: Navegación post-match del comercio', () => {
    it('solicitud en estado matched vincula botón "Ver detalle" a /trips/[id] en lugar de /merchant/requests/[id]', () => {
      render(<MerchantRequestsList requests={mockRequests} metrics={mockMetrics} />);

      const detailLinks = screen.getAllByRole('link', { name: /ver detalle/i });
      expect(detailLinks.length).toBe(1);
      expect(detailLinks[0]?.getAttribute('href')).toBe('/trips/req-3');
    });

    it('solicitud en estado in_transit vincula botón "Ver detalle" a /trips/[id]', () => {
      const inTransitRequest: MerchantRequestSummary = {
        ...mockRequests[0]!,
        id: 'req-in-transit',
        status: 'in_transit',
      };

      render(
        <MerchantRequestsList
          requests={[inTransitRequest]}
          metrics={mockMetrics}
        />
      );

      const detailLink = screen.getByRole('link', { name: /ver detalle/i });
      expect(detailLink.getAttribute('href')).toBe('/trips/req-in-transit');
    });
  });
});

describe('C07: MerchantHistoryView (PR87-H17 / PR87-H18)', () => {
  const historyRequests: MerchantRequestSummary[] = [
    {
      id: 'req-deliv',
      pickupZoneName: 'Centro',
      dropoffZoneName: 'Sarmiento',
      approxDistanceKm: '1,9',
      packageType: 'mediano',
      recipientPaymentMethod: 'cash',
      needsChange: false,
      status: 'delivered',
      expiresAt: null,
      createdAt: '2026-09-24T12:00:00Z',
      offersCount: 2,
      acceptedOfferId: 'off-real',
      acceptedAmountArs: 2300,
      acceptedCourierName: 'Lucas Gómez',
    },
    {
      id: 'req-exp',
      pickupZoneName: 'Centro',
      dropoffZoneName: 'Belgrano',
      approxDistanceKm: '2,1',
      packageType: 'chico',
      recipientPaymentMethod: 'transfer',
      needsChange: false,
      status: 'expired',
      expiresAt: '2026-09-23T12:00:00Z',
      createdAt: '2026-09-23T10:00:00Z',
      offersCount: 0,
      acceptedOfferId: null,
      acceptedAmountArs: null,
      acceptedCourierName: null,
    },
    {
      id: 'req-pub',
      pickupZoneName: 'Zona Activa Intrusa',
      dropoffZoneName: 'Barrio Sur',
      approxDistanceKm: '1,2',
      packageType: 'sobre',
      recipientPaymentMethod: 'cash',
      needsChange: false,
      status: 'published',
      expiresAt: '2026-09-24T15:00:00Z',
      createdAt: '2026-09-24T13:00:00Z',
      offersCount: 1,
      acceptedOfferId: null,
      acceptedAmountArs: null,
      acceptedCourierName: null,
    },
  ];

  it('muestra repartidor y monto aceptado real cuando existe oferta aceptada, y fallback honesto cuando no (PR87-H18)', () => {
    render(<MerchantHistoryView requests={historyRequests} activeStatus="all" nextCursor={null} />);

    expect(screen.getByText('Lucas Gómez')).toBeDefined();
    expect(screen.getByText('$ 2.300')).toBeDefined();
    expect(screen.getByText('Sin repartidor asignado · Sin tarifa acordada')).toBeDefined();
    // PR87-H17: excluye solicitudes activas en status="all"
    expect(screen.queryByText(/Zona Activa Intrusa/i)).toBeNull();
  });

  it('H06: renderiza solicitud multi-drop con destinos múltiples y badge de entregas en historial', () => {
    const multiDropHistoryReq: MerchantRequestSummary = {
      id: 'req-hist-md',
      pickupZoneName: 'Centro Aguilares',
      dropoffZoneName: 'Barrio Norte',
      approxDistanceKm: '3,2',
      packageType: 'chico',
      recipientPaymentMethod: 'cash',
      needsChange: false,
      status: 'delivered',
      expiresAt: null,
      createdAt: '2026-09-24T12:00:00Z',
      offersCount: 1,
      acceptedOfferId: 'off-1',
      acceptedAmountArs: 2500,
      acceptedCourierName: 'María Pérez',
      dropsCount: 2,
      drops: [
        {
          id: 'd1',
          position: 1,
          dropoffZoneName: 'Barrio Norte',
          packageType: 'chico',
          recipientPaymentMethod: 'cash',
          needsChange: false,
        },
        {
          id: 'd2',
          position: 2,
          dropoffZoneName: 'Barrio Sur',
          packageType: 'grande',
          recipientPaymentMethod: 'transfer',
          needsChange: false,
        },
      ],
    };

    render(
      <MerchantHistoryView
        requests={[multiDropHistoryReq]}
        activeStatus="all"
        nextCursor={null}
      />
    );

    expect(screen.getByText('Centro Aguilares → Barrio Norte · Barrio Sur')).toBeDefined();
    expect(screen.getByText('2 entregas')).toBeDefined();
    expect(screen.getByText(/chico · grande/i)).toBeDefined();
  });
});

describe('H06: MerchantRequestsList con multi-drop', () => {
  it('renderiza destinos múltiples, badge de entregas, paquetes y medios combinados', () => {
    const multiDropRequest: MerchantRequestSummary = {
      id: 'req-md-active',
      pickupZoneName: 'Barrio Centro',
      dropoffZoneName: 'Barrio Norte',
      approxDistanceKm: '4,5',
      packageType: 'chico',
      recipientPaymentMethod: 'cash',
      needsChange: false,
      status: 'published',
      expiresAt: '2026-09-24T12:00:00Z',
      createdAt: '2026-09-24T09:30:00Z',
      offersCount: 2,
      acceptedOfferId: null,
      dropsCount: 3,
      drops: [
        {
          id: 'd1',
          position: 1,
          dropoffZoneName: 'Barrio Norte',
          packageType: 'chico',
          recipientPaymentMethod: 'cash',
          needsChange: false,
        },
        {
          id: 'd2',
          position: 2,
          dropoffZoneName: 'Barrio Este',
          packageType: 'mediano',
          recipientPaymentMethod: 'transfer',
          needsChange: false,
        },
        {
          id: 'd3',
          position: 3,
          dropoffZoneName: 'Barrio Sur',
          packageType: 'grande',
          recipientPaymentMethod: 'cash',
          needsChange: false,
        },
      ],
    };

    render(
      <MerchantRequestsList
        requests={[multiDropRequest]}
        metrics={{ dispatchedToday: 1, avgRateArs: 2000, activeCount: 1 }}
      />
    );

    expect(screen.getByText('Barrio Norte · Barrio Este · Barrio Sur')).toBeDefined();
    expect(screen.getByText('3 entregas')).toBeDefined();
    expect(screen.getByText('Paquetes: Chico, Mediano, Grande')).toBeDefined();
    expect(screen.getByText('Medios: Efectivo, Transferencia')).toBeDefined();
  });
});

describe('T-364: Cancelar desde «Mis solicitudes» del comercio sin entrar al detalle', () => {
  const t364Metrics: MerchantMetrics = {
    dispatchedToday: 2,
    avgRateArs: 1500,
    activeCount: 3,
  };

  const nowMs = Date.now();
  const t364Requests: MerchantRequestSummary[] = [
    {
      id: 'req-pub-vigente',
      pickupZoneName: 'Barrio Centro',
      dropoffZoneName: 'Barrio Norte',
      approxDistanceKm: '2,5',
      packageType: 'chico',
      recipientPaymentMethod: 'cash',
      needsChange: true,
      status: 'published',
      expiresAt: new Date(nowMs + 30 * 60 * 1000).toISOString(), // Vigente (+30m)
      createdAt: new Date(nowMs - 5 * 60 * 1000).toISOString(),
      offersCount: 0,
      acceptedOfferId: null,
    },
    {
      id: 'req-pub-vencida',
      pickupZoneName: 'Barrio Centro',
      dropoffZoneName: 'Barrio Sur',
      approxDistanceKm: '1,5',
      packageType: 'chico',
      recipientPaymentMethod: 'cash',
      needsChange: false,
      status: 'published',
      expiresAt: new Date(nowMs - 30 * 60 * 1000).toISOString(), // Vencida (-30m)
      createdAt: new Date(nowMs - 60 * 60 * 1000).toISOString(),
      offersCount: 0,
      acceptedOfferId: null,
    },
    {
      id: 'req-matched-2',
      pickupZoneName: 'San Martín',
      dropoffZoneName: 'Villa Nueva',
      approxDistanceKm: '1,8',
      packageType: 'mediano',
      recipientPaymentMethod: 'transfer',
      needsChange: false,
      status: 'matched',
      expiresAt: new Date(nowMs + 30 * 60 * 1000).toISOString(),
      createdAt: new Date(nowMs - 10 * 60 * 1000).toISOString(),
      offersCount: 1,
      acceptedOfferId: 'off-1',
    },
    {
      id: 'req-transit-3',
      pickupZoneName: 'Centro',
      dropoffZoneName: 'Barrio Colón',
      approxDistanceKm: '3,0',
      packageType: 'grande',
      recipientPaymentMethod: 'cash',
      needsChange: false,
      status: 'in_transit',
      expiresAt: new Date(nowMs + 30 * 60 * 1000).toISOString(),
      createdAt: new Date(nowMs - 15 * 60 * 1000).toISOString(),
      offersCount: 1,
      acceptedOfferId: 'off-2',
    },
    {
      id: 'req-delivered-4',
      pickupZoneName: 'Centro',
      dropoffZoneName: 'Barrio Sarmiento',
      approxDistanceKm: '2,0',
      packageType: 'chico',
      recipientPaymentMethod: 'cash',
      needsChange: false,
      status: 'delivered',
      expiresAt: new Date(nowMs + 30 * 60 * 1000).toISOString(),
      createdAt: new Date(nowMs - 120 * 60 * 1000).toISOString(),
      offersCount: 1,
      acceptedOfferId: 'off-3',
    },
    {
      id: 'req-cancelled-5',
      pickupZoneName: 'Centro',
      dropoffZoneName: 'Barrio Belgrano',
      approxDistanceKm: '1,2',
      packageType: 'chico',
      recipientPaymentMethod: 'cash',
      needsChange: false,
      status: 'cancelled',
      expiresAt: new Date(nowMs + 30 * 60 * 1000).toISOString(),
      createdAt: new Date(nowMs - 180 * 60 * 1000).toISOString(),
      offersCount: 0,
      acceptedOfferId: null,
    },
  ];

  it('DoD 1, 2 & PR361-H04: muestra botón «Cancelar» solo para published vigente y matched; lo oculta en published vencida, in_transit y terminales', () => {
    render(<MerchantRequestsList requests={t364Requests} metrics={t364Metrics} />);

    // Cancelar debe estar visible exactamente para req-pub-vigente y req-matched-2 (2 veces)
    const cancelButtons = screen.getAllByRole('button', { name: /cancelar/i });
    expect(cancelButtons.length).toBe(2);

    // Las acciones principales siguen presentes
    expect(screen.getAllByRole('link', { name: /ver ofertas/i }).length).toBe(2);
    expect(screen.getAllByRole('link', { name: /ver detalle/i }).length).toBe(2);
  });

  it('DoD 3: al hacer click en «Cancelar», abre el modal solicitando motivo (paso 1)', () => {
    render(<MerchantRequestsList requests={t364Requests} metrics={t364Metrics} />);

    const cancelButtons = screen.getAllByRole('button', { name: /cancelar/i });
    fireEvent.click(cancelButtons[0]!);

    expect(screen.getByText(/¿Por qué cancelás esta solicitud\?/i)).toBeDefined();
    expect(screen.getByText('Ya no hace falta')).toBeDefined();
    expect(screen.getByText('Lo resolví de otra forma')).toBeDefined();
    expect(screen.getByText('Me equivoqué en los datos')).toBeDefined();
    expect(screen.getByText('Otro')).toBeDefined();

    // Botón continuar deshabilitado hasta seleccionar motivo
    const continueBtn = screen.getByRole('button', { name: /continuar/i });
    expect(continueBtn.hasAttribute('disabled') || continueBtn.getAttribute('aria-disabled') === 'true').toBe(true);
  });

  it('DoD 3: seleccionar motivo habilita Continuar y muestra confirmación definitiva en paso 2', () => {
    render(<MerchantRequestsList requests={t364Requests} metrics={t364Metrics} />);

    const cancelButtons = screen.getAllByRole('button', { name: /cancelar/i });
    fireEvent.click(cancelButtons[0]!);

    const reasonOption = screen.getByLabelText('Ya no hace falta');
    fireEvent.click(reasonOption);

    const continueBtn = screen.getByRole('button', { name: /continuar/i });
    expect(continueBtn.hasAttribute('disabled')).toBe(false);
    fireEvent.click(continueBtn);

    expect(screen.getByText(/¿Confirmás la cancelación definitiva\?/i)).toBeDefined();
    expect(screen.getByText(/Las ofertas se van a cerrar\. No se puede deshacer\./i)).toBeDefined();
    expect(screen.getByRole('button', { name: /sí, cancelar/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /atrás/i })).toBeDefined();
  });

  it('DoD 3: botón Atrás en paso 2 vuelve al paso 1 conservando el motivo seleccionado', () => {
    render(<MerchantRequestsList requests={t364Requests} metrics={t364Metrics} />);

    const cancelButtons = screen.getAllByRole('button', { name: /cancelar/i });
    fireEvent.click(cancelButtons[0]!);

    fireEvent.click(screen.getByLabelText('Lo resolví de otra forma'));
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    expect(screen.getByText(/¿Confirmás la cancelación definitiva\?/i)).toBeDefined();

    const backBtn = screen.getByRole('button', { name: /atrás/i });
    fireEvent.click(backBtn);

    expect(screen.getByText(/¿Por qué cancelás esta solicitud\?/i)).toBeDefined();
    const reasonRadio = screen.getByLabelText('Lo resolví de otra forma') as HTMLInputElement;
    expect(reasonRadio.checked).toBe(true);
  });

  it('DoD 1 & PR361-H09: confirmar cancelación ejecuta acción productiva con requestId y motivo, notificando éxito y refrescando exactamente una vez', async () => {
    const validUuid = '11111111-2222-3333-4444-555555555555';
    vi.mocked(cancelMerchantRequestAction).mockResolvedValueOnce({
      ok: true,
      data: {
        requestId: validUuid,
        status: 'cancelled',
        cancelledAt: '2026-10-15T01:00:00.000Z',
      },
    });

    render(<MerchantRequestsList requests={t364Requests} metrics={t364Metrics} />);

    const cancelButtons = screen.getAllByRole('button', { name: /cancelar/i });
    fireEvent.click(cancelButtons[0]!); // req-pub-vigente

    fireEvent.click(screen.getByLabelText('Lo resolví de otra forma'));
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    const confirmBtn = screen.getByRole('button', { name: /sí, cancelar/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(cancelMerchantRequestAction).toHaveBeenCalledWith({
        requestId: 'req-pub-vigente',
        reason: 'Lo resolví de otra forma',
      });
    });

    await waitFor(() => {
      expect(notify.success).toHaveBeenCalledWith('Solicitud cancelada.');
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('DoD 1 & PR361-H09: compatibilidad con prop inyectable onCancel con RpcOutput canónico', async () => {
    const mockOnCancel = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        requestId: 'req-pub-vigente',
        status: 'cancelled' as const,
        cancelledAt: '2026-10-15T01:00:00.000Z',
      },
    });

    render(
      <MerchantRequestsList
        requests={t364Requests}
        metrics={t364Metrics}
        onCancel={mockOnCancel}
      />
    );

    const cancelButtons = screen.getAllByRole('button', { name: /cancelar/i });
    fireEvent.click(cancelButtons[0]!);

    fireEvent.click(screen.getByLabelText('Ya no hace falta'));
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    fireEvent.click(screen.getByRole('button', { name: /sí, cancelar/i }));

    await waitFor(() => {
      expect(mockOnCancel).toHaveBeenCalledWith('req-pub-vigente', 'Ya no hace falta');
      expect(notify.success).toHaveBeenCalledWith('Solicitud cancelada.');
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('DoD 3 & PR361-H09: error por carrera concurrente (INVALID_STATE_TRANSITION) muestra mensaje literal amigable y refresca', async () => {
    vi.mocked(cancelMerchantRequestAction).mockResolvedValueOnce({
      ok: false,
      code: 'INVALID_STATE_TRANSITION',
    });

    render(<MerchantRequestsList requests={t364Requests} metrics={t364Metrics} />);

    const cancelButtons = screen.getAllByRole('button', { name: /cancelar/i });
    fireEvent.click(cancelButtons[1]!); // req-matched-2

    fireEvent.click(screen.getByLabelText('Otro'));
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    fireEvent.click(screen.getByRole('button', { name: /sí, cancelar/i }));

    await waitFor(() => {
      expect(cancelMerchantRequestAction).toHaveBeenCalledWith({
        requestId: 'req-matched-2',
        reason: 'Otro',
      });
    });

    await waitFor(() => {
      expect(notify.error).toHaveBeenCalledWith('El estado actual del pedido no permite este cambio.');
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('PR361-H09: error cuando el servidor responde REQUEST_EXPIRED muestra mensaje literal y refresca', async () => {
    vi.mocked(cancelMerchantRequestAction).mockResolvedValueOnce({
      ok: false,
      code: 'REQUEST_EXPIRED',
    });

    render(<MerchantRequestsList requests={t364Requests} metrics={t364Metrics} />);

    const cancelButtons = screen.getAllByRole('button', { name: /cancelar/i });
    fireEvent.click(cancelButtons[0]!); // req-pub-vigente

    fireEvent.click(screen.getByLabelText('Ya no hace falta'));
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    fireEvent.click(screen.getByRole('button', { name: /sí, cancelar/i }));

    await waitFor(() => {
      expect(cancelMerchantRequestAction).toHaveBeenCalledWith({
        requestId: 'req-pub-vigente',
        reason: 'Ya no hace falta',
      });
    });

    await waitFor(() => {
      expect(notify.error).toHaveBeenCalledWith('La solicitud venció por falta de ofertas a tiempo.');
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('PR361-H08: error de red o excepción rechazada captura en catch, muestra notify.error amigable, no muestra éxito y refresca', async () => {
    vi.mocked(cancelMerchantRequestAction).mockRejectedValueOnce(new Error('Network failure'));

    render(<MerchantRequestsList requests={t364Requests} metrics={t364Metrics} />);

    const cancelButtons = screen.getAllByRole('button', { name: /cancelar/i });
    fireEvent.click(cancelButtons[0]!);

    fireEvent.click(screen.getByLabelText('Me equivoqué en los datos'));
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    fireEvent.click(screen.getByRole('button', { name: /sí, cancelar/i }));

    await waitFor(() => {
      expect(cancelMerchantRequestAction).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(notify.error).toHaveBeenCalledWith(
        'No se pudo conectar para cancelar la solicitud. Intentá nuevamente.'
      );
      expect(notify.success).not.toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('PR361-H07: guarda sincrónica inFlightRef bloquea doble confirmación concurrente antes del re-render', async () => {
    type CancelResult = Awaited<ReturnType<typeof cancelMerchantRequestAction>>;
    let resolveAction!: (result: CancelResult) => void;
    const deferredPromise = new Promise<CancelResult>((resolve) => {
      resolveAction = resolve;
    });

    vi.mocked(cancelMerchantRequestAction).mockReturnValueOnce(deferredPromise);

    render(<MerchantRequestsList requests={t364Requests} metrics={t364Metrics} />);

    const cancelButtons = screen.getAllByRole('button', { name: /cancelar/i });
    fireEvent.click(cancelButtons[0]!);

    fireEvent.click(screen.getByLabelText('Ya no hace falta'));
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    const confirmBtn = screen.getByRole('button', { name: /sí, cancelar/i });

    // Disparar dos clicks consecutivos inmediatos
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);

    expect(cancelMerchantRequestAction).toHaveBeenCalledTimes(1);

    // Resolver la acción en vuelo
    resolveAction({
      ok: true,
      data: {
        requestId: 'req-pub-vigente',
        status: 'cancelled',
        cancelledAt: '2026-10-15T01:00:00.000Z',
      },
    });

    await waitFor(() => {
      expect(notify.success).toHaveBeenCalledWith('Solicitud cancelada.');
    });
  });

  it('PR361-H06: reset de diálogo garantiza que aperturas consecutivas inicien en paso 1 con motivo vacío y Continuar deshabilitado', async () => {
    vi.mocked(cancelMerchantRequestAction).mockResolvedValue({
      ok: true,
      data: {
        requestId: 'req-pub-vigente',
        status: 'cancelled',
        cancelledAt: '2026-10-15T01:00:00.000Z',
      },
    });

    render(<MerchantRequestsList requests={t364Requests} metrics={t364Metrics} />);

    // 1. Abrir diálogo para solicitud A, avanzar a paso 2 y confirmar
    const cancelButtons = screen.getAllByRole('button', { name: /cancelar/i });
    fireEvent.click(cancelButtons[0]!); // Solicitud 1

    fireEvent.click(screen.getByLabelText('Lo resolví de otra forma'));
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    expect(screen.getByText(/¿Confirmás la cancelación definitiva\?/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /sí, cancelar/i }));

    await waitFor(() => {
      expect(notify.success).toHaveBeenCalledTimes(1);
    });

    // 2. Abrir diálogo para solicitud B: debe iniciar en paso 1, sin motivo y Continuar deshabilitado
    fireEvent.click(cancelButtons[1]!); // Solicitud 2
    expect(screen.getByText(/¿Por qué cancelás esta solicitud\?/i)).toBeDefined();
    const continueBtn = screen.getByRole('button', { name: /continuar/i });
    expect(continueBtn.hasAttribute('disabled') || continueBtn.getAttribute('aria-disabled') === 'true').toBe(true);

    // Verificar que ningún radio está marcado
    const radios = screen.getAllByRole('radio');
    radios.forEach((r) => {
      expect((r as HTMLInputElement).checked).toBe(false);
    });
  });

  it('PR361-H10: botón «Cancelar» y enlaces del listado tienen clase min-h-12 (>=48px)', () => {
    render(<MerchantRequestsList requests={t364Requests} metrics={t364Metrics} />);

    const cancelButtons = screen.getAllByRole('button', { name: /cancelar/i });
    cancelButtons.forEach((btn) => {
      expect(btn.className).toContain('min-h-12');
    });

    const detailLinks = screen.getAllByRole('link', { name: /ver ofertas|ver detalle/i });
    detailLinks.forEach((link) => {
      expect(link.className).toContain('min-h-12');
    });
  });
});

describe('T-381: el conteo de la tarjeta vuelve a coincidir al reingresar al panel', () => {
  const metrics: MerchantMetrics = { dispatchedToday: 0, avgRateArs: 0, activeCount: 1 };

  function published(offersCount: number): MerchantRequestSummary[] {
    return [
      {
        id: 'req-381',
        pickupZoneName: 'Centro',
        dropoffZoneName: 'Barrio Norte',
        approxDistanceKm: '2,5',
        packageType: 'chico',
        recipientPaymentMethod: 'cash',
        needsChange: false,
        status: 'published',
        expiresAt: '2099-01-01T00:00:00Z',
        createdAt: '2026-10-20T10:00:00Z',
        offersCount,
        acceptedOfferId: null,
      },
    ];
  }

  it('entrar al detalle, que cambien las ofertas y volver por navegación interna refresca el panel: de 2 a 1, sin foco, visibilidad ni Realtime', async () => {
    vi.useFakeTimers();
    try {
      const Panel = MerchantRequestsList;
      // Más que cualquier debounce razonable del refresco: el test no depende del valor exacto.
      const settle = 2_000;

      // «Servidor»: lo que devuelve un router.refresh(). El panel recibe props del payload del router.
      let serverRequests = published(2);
      let applyRefresh: (next: MerchantRequestSummary[]) => void = () => undefined;
      mockRefresh.mockImplementation(() => applyRefresh(serverRequests));
      const focusListener = vi.fn();
      window.addEventListener('focus', focusListener);

      function App() {
        const [route, setRoute] = React.useState<'panel' | 'detail'>('panel');
        const [routerPayload, setRouterPayload] = React.useState(serverRequests);
        applyRefresh = setRouterPayload;
        return (
          <>
            <button type="button" onClick={() => setRoute(route === 'panel' ? 'detail' : 'panel')}>
              navegar
            </button>
            {route === 'panel' ? <Panel requests={routerPayload} metrics={metrics} /> : <p>Detalle</p>}
          </>
        );
      }

      render(<App />);
      expect(screen.getByText('2 ofertas recibidas')).toBeDefined();
      await act(async () => {
        vi.advanceTimersByTime(settle);
      });
      expect(mockRefresh).not.toHaveBeenCalled();

      // Al detalle; mientras tanto el admin suspende a un ofertante y queda una oferta pendiente.
      fireEvent.click(screen.getByRole('button', { name: 'navegar' }));
      expect(screen.getByText('Detalle')).toBeDefined();
      serverRequests = published(1);

      // Vuelta al panel: el payload del router sigue diciendo 2 hasta que el panel se refresca.
      fireEvent.click(screen.getByRole('button', { name: 'navegar' }));
      expect(screen.getByText('2 ofertas recibidas')).toBeDefined();
      await act(async () => {
        vi.advanceTimersByTime(settle);
      });

      expect(screen.getByText('1 oferta recibida')).toBeDefined();
      expect(screen.queryByText('2 ofertas recibidas')).toBeNull();
      expect(mockRefresh).toHaveBeenCalledTimes(1);
      expect(focusListener).not.toHaveBeenCalled();
      window.removeEventListener('focus', focusListener);
    } finally {
      mockRefresh.mockReset();
      vi.useRealTimers();
    }
  });
});
