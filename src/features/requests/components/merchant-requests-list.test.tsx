// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MerchantRequestsList } from './merchant-requests-list';
import { MerchantHistoryView } from './merchant-history-view';
import type { MerchantRequestSummary, MerchantMetrics } from '../types';
import { notify } from '@/ui/notify';
import { getDomainErrorMessage } from '@/lib/error-messages';

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

beforeEach(() => {
  vi.clearAllMocks();
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

  it('DoD 1 & PR361-H02: confirmar cancelación ejecuta acción con requestId y motivo, notificando éxito y refrescando exactamente una vez', async () => {
    const mockOnCancel = vi.fn().mockResolvedValue({ ok: true, data: { status: 'cancelled' } });

    render(
      <MerchantRequestsList
        requests={t364Requests}
        metrics={t364Metrics}
        onCancel={mockOnCancel}
      />
    );

    const cancelButtons = screen.getAllByRole('button', { name: /cancelar/i });
    fireEvent.click(cancelButtons[0]!); // req-pub-vigente

    fireEvent.click(screen.getByLabelText('Lo resolví de otra forma'));
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    const confirmBtn = screen.getByRole('button', { name: /sí, cancelar/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockOnCancel).toHaveBeenCalledWith('req-pub-vigente', 'Lo resolví de otra forma');
    });

    await waitFor(() => {
      expect(notify.success).toHaveBeenCalledWith(expect.stringMatching(/cancelad[ao]/i));
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('DoD 3, PR361-H02 & PR361-H03: error por carrera concurrente (INVALID_STATE_TRANSITION) muestra error amigable y refresca exactamente una vez', async () => {
    const mockOnCancel = vi.fn().mockResolvedValue({
      ok: false,
      code: 'INVALID_STATE_TRANSITION',
    });

    render(
      <MerchantRequestsList
        requests={t364Requests}
        metrics={t364Metrics}
        onCancel={mockOnCancel}
      />
    );

    const cancelButtons = screen.getAllByRole('button', { name: /cancelar/i });
    fireEvent.click(cancelButtons[1]!); // req-matched-2

    fireEvent.click(screen.getByLabelText('Otro'));
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    fireEvent.click(screen.getByRole('button', { name: /sí, cancelar/i }));

    await waitFor(() => {
      expect(mockOnCancel).toHaveBeenCalledWith('req-matched-2', 'Otro');
    });

    await waitFor(() => {
      expect(notify.error).toHaveBeenCalledWith(getDomainErrorMessage('INVALID_STATE_TRANSITION'));
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('PR361-H03 & PR361-H04: error cuando el servidor responde REQUEST_EXPIRED notifica error y refresca la vista', async () => {
    const mockOnCancel = vi.fn().mockResolvedValue({
      ok: false,
      code: 'REQUEST_EXPIRED',
    });

    render(
      <MerchantRequestsList
        requests={t364Requests}
        metrics={t364Metrics}
        onCancel={mockOnCancel}
      />
    );

    const cancelButtons = screen.getAllByRole('button', { name: /cancelar/i });
    fireEvent.click(cancelButtons[0]!); // req-pub-vigente

    fireEvent.click(screen.getByLabelText('Ya no hace falta'));
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    fireEvent.click(screen.getByRole('button', { name: /sí, cancelar/i }));

    await waitFor(() => {
      expect(mockOnCancel).toHaveBeenCalledWith('req-pub-vigente', 'Ya no hace falta');
    });

    await waitFor(() => {
      expect(notify.error).toHaveBeenCalledWith(getDomainErrorMessage('REQUEST_EXPIRED'));
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });
});

