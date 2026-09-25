// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MerchantRequestsList } from './merchant-requests-list';
import { MerchantHistoryView } from './merchant-history-view';
import type { MerchantRequestSummary, MerchantMetrics } from '../types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

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
      cashChangeAmount: 5000,
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
      cashChangeAmount: null,
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
      cashChangeAmount: null,
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
        cashChangeAmount: null,
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
      cashChangeAmount: null,
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
      cashChangeAmount: null,
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
      cashChangeAmount: null,
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
    render(
      <MerchantHistoryView
        requests={historyRequests}
        activeStatus="all"
        nextCursor={null}
      />
    );

    expect(screen.getByText('Lucas Gómez')).toBeDefined();
    expect(screen.getByText('$ 2.300')).toBeDefined();
    expect(screen.getByText('Sin repartidor asignado · Sin tarifa acordada')).toBeDefined();
    // PR87-H17: excluye solicitudes activas en status="all"
    expect(screen.queryByText(/Zona Activa Intrusa/i)).toBeNull();
  });
});

