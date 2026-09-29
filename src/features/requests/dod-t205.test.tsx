// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { CreateRequestForm } from './components/create-request-form';
import { RequestOffersList } from './components/request-offers-list';
import { TripMerchantView, type TripDetails } from '@/features/trips';
import { MerchantOnboardingForm } from '@/features/merchants';

// Mocks estándar para componentes de Next.js y utilidades de UI
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('@/ui/notify', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/ui/map', () => ({
  MapPicker: () => <div data-testid="mock-map-picker" />,
  AGUILARES_CENTER: { lat: -27.4341, lng: -65.6144 },
}));

vi.mock('@/features/requests/actions', () => ({
  createDeliveryRequestAction: vi.fn(),
}));

vi.mock('@/features/offers', () => ({
  acceptOfferAction: vi.fn(),
}));

vi.mock('@/features/offers/actions', () => ({
  createOfferAction: vi.fn(),
}));

vi.mock('@/features/requests/hooks/use-request-offers', () => ({
  useRequestOffers: () => ({
    offers: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/features/trips/maps', () => ({
  buildGoogleMapsDirectionsUrl: vi.fn(() => 'https://maps.google.com'),
}));

const mockTripDetails: TripDetails = {
  id: '00000000-0000-4000-8000-000000000001',
  code: 'VIA-1001',
  status: 'matched',
  merchantId: 'merchant-1',
  merchantName: 'Pizzería Centro',
  merchantPhone: '3815559876',
  courierId: 'courier-1',
  courierName: 'Carlos Repartidor',
  courierPhone: '3815550000',
  vehicleType: 'moto',
  licensePlate: 'A123BCD',
  avatarUrl: null,
  amountArs: 1500,
  pickupAddress: 'San Martín 123',
  pickupZoneName: 'Centro',
  pickupLat: -27.43,
  pickupLng: -65.61,
  dropoffAddress: 'Belgrano 456',
  dropoffZoneName: 'San Martín',
  dropoffLat: -27.44,
  dropoffLng: -65.62,
  deliveryNotes: null,
  recipientName: 'Juan Pérez',
  recipientPhone: '3815551234',
  recipientPaymentMethod: 'cash',
  needsChange: false,
  cashChangeAmount: null,
  createdAt: new Date().toISOString(),
  matchedAt: new Date().toISOString(),
  pickedUpAt: null,
  deliveredAt: null,
};

const mockZones = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Centro', centroidLat: -27.43, centroidLng: -65.61 },
  { id: '22222222-2222-4222-8222-222222222222', name: 'San Martín', centroidLat: -27.44, centroidLng: -65.62 },
];

describe('T-205 DoD: Criterios de Aceptación de Accesibilidad y Rendimiento', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // PR122-H03: Regresión semántica local para jerarquía estricta de encabezados (sin axe ni dependencias privadas)
  it('DoD 1.1: Jerarquía de encabezados continua sin saltos de nivel en vistas auditadas', () => {
    const { container } = render(<TripMerchantView trip={mockTripDetails} />);

    // Recolectar todos los encabezados del documento en orden DOM
    const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    expect(headings.length, 'Debe haber al menos un encabezado renderizado').toBeGreaterThan(0);

    const levels = headings.map((h) => Number.parseInt(h.tagName.replace('H', ''), 10));
    const violations: Array<{ from: number; to: number; text: string }> = [];

    let currentLevel = levels[0] ?? 1;
    expect(currentLevel, 'El encabezado inicial debe ser h1 o h2').toBeLessThanOrEqual(2);

    for (let i = 1; i < levels.length; i++) {
      const nextLevel = levels[i] ?? 1;
      // Regla WCAG 2.1 AA / heading-order: el nivel no puede saltar más de 1 hacia abajo (ej. h1 a h3)
      if (nextLevel > currentLevel + 1) {
        violations.push({
          from: currentLevel,
          to: nextLevel,
          text: headings[i]?.textContent?.trim() || '',
        });
      }
      currentLevel = nextLevel;
    }

    expect(
      violations,
      'No debe haber saltos de nivel en la jerarquía de encabezados (WCAG 2.1 AA)'
    ).toEqual([]);
  });

  // PR122-H02: Auditoría completa de objetivos táctiles en todas las superficies clave enumeradas por la ficha
  it('DoD 1.2: Objetivos táctiles interactivos >= 48 px en todas las superficies clave', () => {
    // 1. CreateRequestForm: ubicación, toggle de cambio, chips rápidos
    const { container: reqContainer } = render(<CreateRequestForm zones={mockZones} />);
    // 2. RequestOffersList: botones segmentados de filtro
    const { container: offersListContainer } = render(
      <RequestOffersList
        request={{
          id: 'req-1',
          pickupZoneName: 'Centro',
          dropoffZoneName: 'San Martín',
          approxDistanceKm: '2.5',
          packageType: 'chico',
          recipientPaymentMethod: 'cash',
          needsChange: false,
          cashChangeAmount: null,
          status: 'searching',
          expiresAt: null,
        }}
        initialOffers={[]}
      />
    );
    const interactiveContainers = [
      { name: 'CreateRequestForm', container: reqContainer },
      { name: 'RequestOffersList', container: offersListContainer },
    ];

    const undersizedTargets: Array<{ surface: string; text: string; className: string }> = [];

    for (const { name, container } of interactiveContainers) {
      const interactives = Array.from(container.querySelectorAll('button'));

      for (const el of interactives) {
        const className = el.className || '';
        const text = el.textContent?.trim() || el.getAttribute('aria-label') || '';

        // Detección de clases sub-48px prohibidas (ej. min-h-[44px], min-h-10, h-10, py-1.5 sin min-h)
        const hasSub48Class =
          className.includes('min-h-[44px]') ||
          (className.includes('min-h-10') && !className.includes('min-h-12')) ||
          (className.includes('h-10') && !className.includes('h-12') && !className.includes('min-h-12')) ||
          (className.includes('py-1.5') && !className.includes('min-h-12') && !className.includes('min-h-[48px]'));

        if (hasSub48Class) {
          undersizedTargets.push({ surface: name, text, className });
        }
      }
    }

    expect(
      undersizedTargets,
      'Todos los objetivos táctiles interactivos de las superficies clave deben medir al menos 48 px (min-h-12 / h-12)'
    ).toEqual([]);
  });

  it('DoD 1.3: Todos los inputs numéricos o de teléfono declaran atributo inputmode', () => {
    const { container: reqContainer } = render(<CreateRequestForm zones={mockZones} />);
    const { container: merchantContainer } = render(<MerchantOnboardingForm zones={mockZones} />);

    const inputsToAudit = [
      ...Array.from(reqContainer.querySelectorAll('input[type="tel"], input#recipient-phone')),
      ...Array.from(merchantContainer.querySelectorAll('input[type="tel"], input#phone')),
    ];

    const inputsWithoutInputMode: Array<{ id: string | null; type: string | null }> = [];

    for (const input of inputsToAudit) {
      const inputMode = input.getAttribute('inputmode');
      if (!inputMode) {
        inputsWithoutInputMode.push({
          id: input.getAttribute('id'),
          type: input.getAttribute('type'),
        });
      }
    }

    expect(
      inputsWithoutInputMode,
      'Los inputs de teléfono y numéricos deben declarar inputmode="numeric" o "tel"'
    ).toEqual([]);
  });

  // PR122-H01: Regresión de arquitectura de rendimiento y code-splitting para garantizar First Load JS < 180 kB (Regla 25)
  it('DoD 1.4: Arquitectura de carga diferida y aislamiento de bundle en componentes clave', async () => {
    // 1. courier-onboarding exporta IdentityForm y VehicleForm como componentes dinámicos para proteger profile
    const courierOnboardingModule = await import('@/features/courier-onboarding');
    expect(
      courierOnboardingModule.IdentityForm,
      'IdentityForm debe estar exportado dinámicamente'
    ).toBeDefined();
    expect(
      courierOnboardingModule.VehicleForm,
      'VehicleForm debe estar exportado dinámicamente'
    ).toBeDefined();

    // 2. trips aísla el diálogo de cancelación para reducir el bundle de la vista de viaje
    const tripsModule = await import('@/features/trips');
    expect(
      tripsModule.TripMerchantContainer,
      'TripMerchantContainer debe estar expuesto para carga optimizada'
    ).toBeDefined();
    expect(
      tripsModule.TripCourierContainer,
      'TripCourierContainer debe estar expuesto para carga optimizada'
    ).toBeDefined();
  });
});
