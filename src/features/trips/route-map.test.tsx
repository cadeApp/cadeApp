// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { TripDetails } from './types';
import { TripCourierView } from './components/trip-courier-view';
import { TripMerchantView } from './components/trip-merchant-view';
import { buildGoogleMapsDirectionsUrl } from './maps';

// Variables de control de mocks para simulación de estados de Google Maps
let mockLoadingStatus = 'LOADED';
let mockPublicApiKey = 'test-google-maps-api-key';
let mockPublicMapId = 'test-map-id';
let mockOnError: (() => void) | null = null;

vi.mock('@/lib/env.public', () => ({
  publicEnv: {
    get NEXT_PUBLIC_GOOGLE_MAPS_API_KEY() {
      return mockPublicApiKey;
    },
    get NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID() {
      return mockPublicMapId;
    },
  },
  getPublicEnv: () => ({
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: mockPublicApiKey,
    NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: mockPublicMapId,
  }),
}));

vi.mock('@vis.gl/react-google-maps', () => ({
  APILoadingStatus: {
    NOT_LOADED: 'NOT_LOADED',
    LOADING: 'LOADING',
    LOADED: 'LOADED',
    FAILED: 'FAILED',
  },
  useApiLoadingStatus: () => mockLoadingStatus,
  APIProvider: ({
    children,
    onError,
  }: {
    children: React.ReactNode;
    onError?: () => void;
  }) => {
    mockOnError = onError ?? null;
    return <div data-testid="mock-api-provider">{children}</div>;
  },
  Map: ({
    children,
  }: {
    children?: React.ReactNode;
    center?: { lat: number; lng: number };
    defaultCenter?: { lat: number; lng: number };
    zoom?: number;
    defaultZoom?: number;
  }) => <div data-testid="mock-google-map">{children}</div>,
  AdvancedMarker: ({
    children,
    position,
    title,
  }: {
    children?: React.ReactNode;
    position?: { lat: number; lng: number };
    title?: string;
  }) => (
    <div
      data-testid="mock-advanced-marker"
      data-lat={position?.lat}
      data-lng={position?.lng}
      data-title={title}
    >
      {children}
    </div>
  ),
  Pin: ({
    background,
    borderColor,
    glyphColor,
  }: {
    background?: string;
    borderColor?: string;
    glyphColor?: string;
  }) => (
    <div
      data-testid="mock-pin"
      data-bg={background}
      data-border={borderColor}
      data-glyph={glyphColor}
    />
  ),
}));

describe('T-117 — Mapa de recorrido y botón "Abrir en Google Maps" en vista de viaje', () => {
  const baseTrip: TripDetails = {
    id: '11111111-2222-3333-4444-555555555555',
    code: 'REQ-ABCD1234',
    status: 'matched',
    merchantId: '00000000-0000-4000-8000-0000000008b1',
    merchantName: 'Panadería La Espiga',
    merchantPhone: '3865222222',
    courierId: '00000000-0000-4000-8000-0000000008c1',
    courierName: 'Joaquín R.',
    courierPhone: '3865111111',
    vehicleType: 'moto',
    licensePlate: 'AB 123 CD',
    avatarUrl: 'https://signed.test/avatar.webp',
    amountArs: 1800,
    pickupAddress: 'San Martín 450, Centro',
    pickupZoneName: 'Centro',
    pickupLat: -27.4333,
    pickupLng: -65.6167,
    dropoffAddress: 'Belgrano 1220, Barrio Norte',
    dropoffZoneName: 'Barrio Norte',
    dropoffLat: -27.4250,
    dropoffLng: -65.6100,
    approxDistanceM: 2500,
    deliveryNotes: 'Tocar timbre 2B · Frágil',
    recipientName: 'Laura M.',
    recipientPhone: '3865123456',
    recipientPaymentMethod: 'cash',
    needsChange: true,
    cashChangeAmount: 2000,
    createdAt: '2026-09-28T10:00:00.000Z',
    matchedAt: '2026-09-28T10:05:00.000Z',
    pickedUpAt: null,
    deliveredAt: null,
  };

  beforeEach(() => {
    mockLoadingStatus = 'LOADED';
    mockPublicApiKey = 'test-google-maps-api-key';
    mockPublicMapId = 'test-map-id';
    mockOnError = null;

    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('1. Feed de repartidor sin mapas ni coordenadas (D3/D15)', () => {
    it('el código del feed de repartidor no importa ni monta ningún mapa ni SDK de Google Maps', () => {
      const feedComponentPath = path.resolve('src/features/offers/components/courier-feed.tsx');
      const feedPagePath = path.resolve('src/app/(courier)/courier/feed/page.tsx');
      const requestCardPath = path.resolve('src/features/offers/components/request-card.tsx');

      for (const filePath of [feedComponentPath, feedPagePath, requestCardPath]) {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          expect(content).not.toMatch(/@vis\.gl\/react-google-maps/);
          expect(content).not.toMatch(/MapPicker/);
          expect(content).not.toMatch(/TripRouteMap/);
          expect(content).not.toMatch(/pickup_lat|pickupLat|dropoff_lat|dropoffLat/);
        }
      }
    });

    it('las queries públicas del feed de solicitudes abiertas no proyectan coordenadas lat/lng', () => {
      const offersQueriesPath = path.resolve('src/features/offers/queries.ts');
      if (fs.existsSync(offersQueriesPath)) {
        const content = fs.readFileSync(offersQueriesPath, 'utf8');
        expect(content).not.toMatch(/pickup_lat/);
        expect(content).not.toMatch(/pickup_lng/);
        expect(content).not.toMatch(/dropoff_lat/);
        expect(content).not.toMatch(/dropoff_lng/);
      }
    });
  });

  describe('2. Mapa visible únicamente después de matched y con dos pines sin live tracking (D7/D15)', () => {
    it('TripCourierView (R07) renderiza la sección de mapa de recorrido y los dos pines tras matched', () => {
      render(<TripCourierView trip={baseTrip} />);

      // Debe existir la tarjeta/sección del mapa de recorrido
      const routeMapSection = screen.getByTestId('trip-route-map');
      expect(routeMapSection).toBeDefined();

      // Debe mostrar el título del recorrido
      expect(screen.getByRole('heading', { name: /recorrido en mapa/i })).toBeDefined();

      // Debe indicar los dos pines fijos: retiro y entrega
      expect(screen.getByTestId('map-pin-pickup')).toBeDefined();
      expect(screen.getByTestId('map-pin-dropoff')).toBeDefined();

      // D7: PROHIBIDO live tracking del cadete — no debe existir pin del repartidor ni tracking en vivo
      expect(screen.queryByTestId('map-pin-courier')).toBeNull();
      expect(screen.queryByTestId('live-courier-tracking')).toBeNull();

      // Direcciones exactas reveladas post-matched
      expect(screen.getByText('San Martín 450, Centro')).toBeDefined();
      expect(screen.getByText('Belgrano 1220, Barrio Norte')).toBeDefined();
    });

    it('TripMerchantView (C06) renderiza la sección de mapa de recorrido y los dos pines tras matched', () => {
      render(<TripMerchantView trip={baseTrip} />);

      const routeMapSection = screen.getByTestId('trip-route-map');
      expect(routeMapSection).toBeDefined();

      expect(screen.getByRole('heading', { name: /mapa del viaje|recorrido en mapa/i })).toBeDefined();
      expect(screen.getByTestId('map-pin-pickup')).toBeDefined();
      expect(screen.getByTestId('map-pin-dropoff')).toBeDefined();

      // Sin live tracking
      expect(screen.queryByTestId('map-pin-courier')).toBeNull();
      expect(screen.queryByTestId('live-courier-tracking')).toBeNull();
    });

    it('la sección de mapa muestra la distancia calculada en servidor con formato aproximado', () => {
      render(<TripCourierView trip={baseTrip} />);
      expect(screen.getByText(/≈ 2,5 km/i)).toBeDefined();
    });
  });

  describe('3. Botón "Abrir en Google Maps" con URL externa canónica y encodeURIComponent', () => {
    it('genera la URL canónica correcta con encodeURIComponent a partir de coordenadas', () => {
      const url = buildGoogleMapsDirectionsUrl({
        origin: { lat: -27.4333, lng: -65.6167 },
        destination: { lat: -27.4250, lng: -65.6100 },
      });

      expect(url).toBe(
        'https://www.google.com/maps/dir/?api=1&origin=-27.4333%2C-65.6167&destination=-27.425%2C-65.61'
      );
    });

    it('genera la URL canónica correcta con encodeURIComponent a partir de direcciones de texto', () => {
      const url = buildGoogleMapsDirectionsUrl({
        origin: 'San Martín 450, Aguilares, Tucumán',
        destination: 'Belgrano 1220, Aguilares, Tucumán',
      });

      expect(url).toBe(
        'https://www.google.com/maps/dir/?api=1&origin=San%20Mart%C3%ADn%20450%2C%20Aguilares%2C%20Tucum%C3%A1n&destination=Belgrano%201220%2C%20Aguilares%2C%20Tucum%C3%A1n'
      );
    });

    it('TripCourierView incluye el botón "Abrir en Google Maps" con target >= 48px y enlace seguro', () => {
      render(<TripCourierView trip={baseTrip} />);

      const mapsLink = screen.getByRole('link', { name: /abrir en google maps/i });
      expect(mapsLink).toBeDefined();
      expect(mapsLink.getAttribute('href')).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&origin=/);
      expect(mapsLink.getAttribute('target')).toBe('_blank');
      expect(mapsLink.getAttribute('rel')).toContain('noopener');
      expect(mapsLink.getAttribute('rel')).toContain('noreferrer');

      // Verificación de target táctil de al menos 48 px de alto para uso en moto
      expect(mapsLink.className).toMatch(/h-12|min-h-\[48px\]|min-h-12/);
    });
  });

  describe('4. Fallback graceful y resiliencia con mapa caído, sin key u offline', () => {
    it('cuando Google Maps falla (APILoadingStatus.FAILED), el botón externo y las direcciones en texto siguen 100% operativos', () => {
      mockLoadingStatus = 'FAILED';

      render(<TripCourierView trip={baseTrip} />);

      // Debe mostrar el fallback del mapa caído
      expect(screen.getByTestId('route-map-fallback')).toBeDefined();

      // El botón externo sigue presente, accesible y habilitado sin depender del SDK
      const mapsLink = screen.getByRole('link', { name: /abrir en google maps/i });
      expect(mapsLink).toBeDefined();
      expect(mapsLink.getAttribute('href')).toContain('https://www.google.com/maps/dir/?api=1');

      // Las direcciones en texto siguen 100% operativas
      expect(screen.getByText('San Martín 450, Centro')).toBeDefined();
      expect(screen.getByText('Belgrano 1220, Barrio Norte')).toBeDefined();
    });

    it('cuando el dispositivo está offline, muestra banner de advertencia y mantiene operativo el botón externo', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      });

      render(<TripCourierView trip={baseTrip} />);

      expect(screen.getByTestId('route-map-offline-banner')).toBeDefined();
      const mapsLink = screen.getByRole('link', { name: /abrir en google maps/i });
      expect(mapsLink).toBeDefined();
      expect(mapsLink.getAttribute('href')).toContain('https://www.google.com/maps/dir/?api=1');
    });

    it('cuando no hay API key configurada, muestra fallback sin romper el render ni el botón externo', () => {
      mockPublicApiKey = '';

      render(<TripCourierView trip={baseTrip} />);

      expect(screen.getByTestId('route-map-fallback')).toBeDefined();
      const mapsLink = screen.getByRole('link', { name: /abrir en google maps/i });
      expect(mapsLink).toBeDefined();
      expect(mapsLink.getAttribute('href')).toContain('https://www.google.com/maps/dir/?api=1');
    });
  });
});
