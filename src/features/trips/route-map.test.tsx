// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen, act, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { TripDetails } from './types';
import { TripCourierView } from './components/trip-courier-view';
import { TripMerchantView } from './components/trip-merchant-view';
import { buildGoogleMapsDirectionsUrl } from './maps';
import {
  buildTripRoutePlan,
  MAX_NAVIGATION_URL_LENGTH,
  MAX_NAVIGATION_WAYPOINTS,
  type TripRouteInput,
  type TripRoutePlan,
} from './route-points';
import { CourierFeed, type AvailableRequestItem } from '@/features/offers';

// Mocks para CourierFeed
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const mockChannel = {
  on: vi.fn(),
  subscribe: vi.fn(),
};

vi.mock('@/lib/supabase/browser', () => ({
  createClient: vi.fn(() => ({
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
  })),
}));

// Variables de control de mocks para simulación de estados de Google Maps
const { mockFitBounds } = vi.hoisted(() => ({ mockFitBounds: vi.fn() }));
let mockLoadingStatus = 'LOADED';
let mockPublicApiKey = 'test-google-maps-api-key';
let mockPublicMapId = 'test-map-id';
let mockOnError: (() => void) | null = null;
// T-377: biblioteca `routes` que devuelve useMapsLibrary; null = todavía no cargó (o no carga nunca).
let mockRoutesLibrary: unknown = null;

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
  useMapsLibrary: (name: string) => (name === 'routes' ? mockRoutesLibrary : null),
  // Como el SDK real: sin mapa cargado (SDK fallido) useMap devuelve null
  useMap: () => (mockLoadingStatus === 'LOADED' ? { fitBounds: mockFitBounds } : null),
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
  Marker: ({
    position,
    title,
    label,
  }: {
    position?: { lat: number; lng: number };
    title?: string;
    label?: string;
  }) => (
    <div
      data-testid="mock-legacy-marker"
      data-lat={position?.lat}
      data-lng={position?.lng}
      data-title={title}
      data-label={label}
    />
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
  Polyline: ({
    path,
  }: {
    path?: Array<{ lat: number; lng: number }>;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeWeight?: number;
  }) => (
    <div
      data-testid="mock-route-polyline"
      data-path={JSON.stringify(path)}
    />
  ),
}));

/**
 * Helper recursivo fail-closed que enumera todos los archivos de producción (.ts / .tsx)
 * bajo un directorio, ignorando tests, specs y directorios __tests__.
 */
function getProductionFilesRecursively(dir: string): string[] {
  expect(fs.existsSync(dir)).toBe(true);
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') {
        files.push(...getProductionFilesRecursively(fullPath));
      }
    } else if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.includes('.test.') &&
      !entry.name.includes('.spec.')
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

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
    routeDistanceM: 2500,
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

  const inTransitTrip: TripDetails = {
    ...baseTrip,
    status: 'in_transit',
    pickedUpAt: '2026-09-28T10:15:00.000Z',
  };

  const sampleRequest: AvailableRequestItem = {
    id: '11111111-1111-1111-1111-111111111111',
    pickupZoneName: 'Centro',
    dropoffZoneName: 'Barrio Norte',
    approxDistanceKm: '2,5',
    packageType: 'chico',
    recipientPaymentMethod: 'cash',
    needsChange: true,
    publishedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 27 * 60 * 1000).toISOString(),
    hasMyOffer: false,
    myOfferAmountArs: null,
  };

  beforeEach(() => {
    mockLoadingStatus = 'LOADED';
    mockPublicApiKey = 'test-google-maps-api-key';
    mockPublicMapId = 'test-map-id';
    mockOnError = null;
    mockRoutesLibrary = null;
    mockFitBounds.mockClear();

    mockChannel.on.mockReturnValue(mockChannel);
    mockChannel.subscribe.mockReturnValue(mockChannel);

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

  describe('1. H01 — Feed de repartidor fail-closed sin mapas ni coordenadas (D3/D15)', () => {
    it('inspecciona exhaustivamente todos los archivos de producción de src/features/offers y feed de repartidor', () => {
      const offersDir = path.resolve('src/features/offers');
      const feedDir = path.resolve('src/app/(courier)/courier/feed');

      expect(fs.existsSync(offersDir)).toBe(true);
      expect(fs.existsSync(feedDir)).toBe(true);

      const offersFiles = getProductionFilesRecursively(offersDir);
      const feedFiles = getProductionFilesRecursively(feedDir);

      expect(offersFiles.length).toBeGreaterThan(0);
      expect(feedFiles.length).toBeGreaterThan(0);

      const allProductionFiles = [...offersFiles, ...feedFiles];

      const FORBIDDEN_TOKENS = [
        '@vis.gl/react-google-maps',
        'MapPicker',
        'TripRouteMap',
        'pickup_lat',
        'pickup_lng',
        'dropoff_lat',
        'dropoff_lng',
        'pickupLat',
        'pickupLng',
        'dropoffLat',
        'dropoffLng',
      ];

      for (const filePath of allProductionFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        for (const token of FORBIDDEN_TOKENS) {
          expect(
            content.includes(token),
            `Violación de D3/D15: El archivo ${filePath} contiene el token prohibido "${token}"`
          ).toBe(false);
        }
      }
    });

    it('CourierFeed en estado aprobado/disponible y con R05 abierta no renderiza mapas, coordenadas ni direcciones exactas', () => {
      render(
        <CourierFeed
          courierStatus="approved"
          isAvailable={true}
          requests={[sampleRequest]}
          minOfferArs={1000}
        />
      );

      // Verificación en feed R04
      expect(screen.queryByTestId('trip-route-map')).toBeNull();
      expect(screen.queryByTestId('mock-advanced-marker')).toBeNull();
      expect(screen.queryByTestId('mock-route-polyline')).toBeNull();
      expect(screen.queryByText(/San Martín 450/i)).toBeNull();
      expect(screen.queryByText(/Belgrano 1220/i)).toBeNull();
      expect(screen.getByText(/Centro/i)).toBeDefined();
      expect(screen.getByText(/Barrio Norte/i)).toBeDefined();
      expect(screen.getByText(/≈ 2,5 km/i)).toBeDefined();

      // Abrir hoja de oferta R05
      const offerBtn = screen.getByRole('button', { name: /ofertar/i });
      fireEvent.click(offerBtn);

      // Verificación en hoja de oferta R05
      expect(screen.queryByTestId('trip-route-map')).toBeNull();
      expect(screen.queryByTestId('mock-advanced-marker')).toBeNull();
      expect(screen.queryByTestId('mock-route-polyline')).toBeNull();
      expect(screen.queryByText(/San Martín 450/i)).toBeNull();
      expect(screen.queryByText(/Belgrano 1220/i)).toBeNull();
      expect(screen.getAllByText(/Centro/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Barrio Norte/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/≈ 2,5 km/i).length).toBeGreaterThan(0);
    });
  });

  describe('2. H02 & H03 — Mapa visible post-matched e in_transit con exactamente 2 markers y traza (D7/D15)', () => {
    it('TripCourierView (R07) en status matched renderiza exactamente 2 markers en retiro/entrega y 1 traza', () => {
      render(<TripCourierView trip={baseTrip} />);

      const routeMapSection = screen.getByTestId('trip-route-map');
      expect(routeMapSection).toBeDefined();
      expect(screen.getByRole('heading', { name: /recorrido en mapa/i })).toBeDefined();

      // Exactamente 2 markers
      const markers = screen.getAllByTestId('mock-advanced-marker');
      expect(markers).toHaveLength(2);

      const positions = markers.map((m) => ({
        lat: Number(m.getAttribute('data-lat')),
        lng: Number(m.getAttribute('data-lng')),
      }));

      expect(positions).toContainEqual({
        lat: baseTrip.pickupLat,
        lng: baseTrip.pickupLng,
      });
      expect(positions).toContainEqual({
        lat: baseTrip.dropoffLat,
        lng: baseTrip.dropoffLng,
      });

      // Exactamente 1 traza que une pickup y dropoff
      const polyline = screen.getByTestId('mock-route-polyline');
      expect(polyline).toBeDefined();
      const pathData = JSON.parse(polyline.getAttribute('data-path') || '[]');
      expect(pathData).toEqual([
        { lat: baseTrip.pickupLat, lng: baseTrip.pickupLng },
        { lat: baseTrip.dropoffLat, lng: baseTrip.dropoffLng },
      ]);

      // D7: PROHIBIDO live tracking del cadete
      expect(screen.queryByTestId('map-pin-courier')).toBeNull();
      expect(screen.queryByTestId('live-courier-tracking')).toBeNull();

      // Direcciones exactas reveladas post-matched
      expect(screen.getByText('San Martín 450, Centro')).toBeDefined();
      expect(screen.getByText('Belgrano 1220, Barrio Norte')).toBeDefined();
    });

    it('TripCourierView (R07) en status in_transit mantiene el mapa, los 2 markers, la traza, direcciones y botón externo', () => {
      render(<TripCourierView trip={inTransitTrip} />);

      expect(screen.getByTestId('trip-route-map')).toBeDefined();

      const markers = screen.getAllByTestId('mock-advanced-marker');
      expect(markers).toHaveLength(2);

      const polyline = screen.getByTestId('mock-route-polyline');
      expect(polyline).toBeDefined();
      const pathData = JSON.parse(polyline.getAttribute('data-path') || '[]');
      expect(pathData).toEqual([
        { lat: inTransitTrip.pickupLat, lng: inTransitTrip.pickupLng },
        { lat: inTransitTrip.dropoffLat, lng: inTransitTrip.dropoffLng },
      ]);

      expect(screen.getByText('San Martín 450, Centro')).toBeDefined();
      expect(screen.getByText('Belgrano 1220, Barrio Norte')).toBeDefined();

      const mapsLink = screen.getByRole('link', { name: /abrir en google maps/i });
      expect(mapsLink).toBeDefined();
      expect(mapsLink.getAttribute('href')).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&origin=/);
    });

    it('TripMerchantView (C06) en status matched e in_transit renderiza los 2 markers y la traza sin botón externo', () => {
      const { rerender } = render(<TripMerchantView trip={baseTrip} />);

      expect(screen.getByTestId('trip-route-map')).toBeDefined();
      expect(screen.getByRole('heading', { name: /mapa del viaje|recorrido en mapa/i })).toBeDefined();

      let markers = screen.getAllByTestId('mock-advanced-marker');
      expect(markers).toHaveLength(2);
      expect(screen.getByTestId('mock-route-polyline')).toBeDefined();

      // C06 no inventa botón externo
      expect(screen.queryByRole('link', { name: /abrir en google maps/i })).toBeNull();

      // Transición a in_transit
      rerender(<TripMerchantView trip={inTransitTrip} />);
      expect(screen.getByTestId('trip-route-map')).toBeDefined();
      markers = screen.getAllByTestId('mock-advanced-marker');
      expect(markers).toHaveLength(2);
      expect(screen.getByTestId('mock-route-polyline')).toBeDefined();
      expect(screen.queryByRole('link', { name: /abrir en google maps/i })).toBeNull();
    });

    it('T-350/T-377: C06 describe la línea recta orientativa con text-primary-dark y nunca text-primary (axe AA)', () => {
      render(<TripMerchantView trip={baseTrip} />);

      expect(screen.queryByText('Ruta directa sin desvíos')).toBeNull();
      const routeNote = screen.getByText('Línea recta orientativa');
      expect(routeNote.classList.contains('text-primary-dark')).toBe(true);
      expect(routeNote.classList.contains('text-primary')).toBe(false);
    });

    it('la sección de mapa muestra la distancia calculada en servidor con formato aproximado', () => {
      render(<TripCourierView trip={baseTrip} />);
      expect(screen.getByText(/≈ 2,5 km/i)).toBeDefined();
    });
  });

  describe('3. Botón "Abrir en Google Maps" con URL canónica y encodeURIComponent', () => {
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

      // Verificación de target táctil de al menos 48 px de alto para uso con guantes en moto
      expect(mapsLink.className).toMatch(/h-12|min-h-\[48px\]|min-h-12/);
    });

    it('PR119-H05: TripCourierView con coordenadas null pasa direcciones completas tal cual sin anexar sufijos duplicados', () => {
      const tripWithoutCoords: TripDetails = {
        ...baseTrip,
        pickupAddress: 'San Martín 450, Aguilares, Tucumán',
        dropoffAddress: 'Belgrano 1220, Concepción, Tucumán',
        pickupLat: null,
        pickupLng: null,
        dropoffLat: null,
        dropoffLng: null,
      };

      render(<TripCourierView trip={tripWithoutCoords} />);

      const mapsLink = screen.getByRole('link', { name: /abrir en google maps/i });
      expect(mapsLink).toBeDefined();

      const href = mapsLink.getAttribute('href');
      expect(href).toBeDefined();

      const expectedOrigin = encodeURIComponent('San Martín 450, Aguilares, Tucumán');
      const expectedDest = encodeURIComponent('Belgrano 1220, Concepción, Tucumán');
      expect(href).toBe(
        `https://www.google.com/maps/dir/?api=1&origin=${expectedOrigin}&destination=${expectedDest}`
      );

      // No debe contener sufijo duplicado como "Aguilares, Tucumán, Aguilares"
      expect(href).not.toContain(encodeURIComponent('Aguilares, Tucumán, Aguilares'));
      expect(href).not.toContain(encodeURIComponent('Concepción, Tucumán, Aguilares'));
    });
  });

  describe('4. H04 — Fallback graceful y resiliencia ante fallo real de APIProvider.onError, status FAILED, offline y sin key', () => {
    it('cuando APIProvider invoca onError directamente, muestra fallback y mantiene operativo el botón externo y las direcciones', async () => {
      render(<TripCourierView trip={baseTrip} />);

      expect(mockOnError).not.toBeNull();
      expect(typeof mockOnError).toBe('function');

      act(() => {
        mockOnError?.();
      });

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

    it('cuando useApiLoadingStatus es FAILED, el botón externo y las direcciones en texto siguen 100% operativos', () => {
      mockLoadingStatus = 'FAILED';

      render(<TripCourierView trip={baseTrip} />);

      expect(screen.getByTestId('route-map-fallback')).toBeDefined();
      const mapsLink = screen.getByRole('link', { name: /abrir en google maps/i });
      expect(mapsLink).toBeDefined();
      expect(mapsLink.getAttribute('href')).toContain('https://www.google.com/maps/dir/?api=1');
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

  describe('5. T-363 — Fallback honesto: coordenadas faltantes, Map ID ausente y distancia no calculada', () => {
    const tripWithoutCoords: TripDetails = {
      ...baseTrip,
      pickupLat: null,
      pickupLng: null,
      dropoffLat: null,
      dropoffLng: null,
      routeDistanceM: null,
    };

    it('sin coordenadas y con proveedor disponible explica la falta de ubicación exacta (nunca «modo simplificado»)', () => {
      render(<TripCourierView trip={tripWithoutCoords} />);

      const fallback = screen.getByTestId('route-map-fallback');
      expect(fallback.textContent).toMatch(/sin ubicación exacta en el mapa/i);
      expect(fallback.textContent).toMatch(/retiro/i);
      expect(fallback.textContent).toMatch(/entrega/i);
      expect(fallback.textContent).not.toMatch(/modo simplificado/i);
      expect(screen.queryByTestId('mock-google-map')).toBeNull();
      expect(screen.queryByTestId('mock-advanced-marker')).toBeNull();
      expect(screen.queryByTestId('mock-route-polyline')).toBeNull();
    });

    it('con retiro geolocalizado y entrega sin pin: fallback nombra solo la entrega y Google Maps usa el punto válido y la dirección escrita', () => {
      const partialTrip: TripDetails = { ...baseTrip, dropoffLat: null, dropoffLng: null };
      render(<TripCourierView trip={partialTrip} />);

      const fallback = screen.getByTestId('route-map-fallback');
      expect(fallback.textContent).toMatch(/sin ubicación exacta en el mapa/i);
      expect(screen.getByTestId('route-map-missing-points').textContent).toMatch(/^.*entrega.*$/i);
      expect(screen.getByTestId('route-map-missing-points').textContent).not.toMatch(/retiro/i);

      const href = screen.getByRole('link', { name: /abrir en google maps/i }).getAttribute('href') ?? '';
      const url = new URL(href);
      expect(url.searchParams.get('origin')).toBe(`${baseTrip.pickupLat},${baseTrip.pickupLng}`);
      expect(url.searchParams.get('destination')).toBe(baseTrip.dropoffAddress);
    });

    it('coordenadas fuera de Aguilares o no finitas se tratan como faltantes y nunca llegan al mapa ni al enlace', () => {
      const invalidTrip: TripDetails = {
        ...baseTrip,
        pickupLat: 0,
        pickupLng: 0,
        dropoffLat: Number.NaN,
        dropoffLng: -65.61,
      };
      render(<TripCourierView trip={invalidTrip} />);

      expect(screen.getByTestId('route-map-fallback')).toBeDefined();
      expect(screen.queryByTestId('mock-advanced-marker')).toBeNull();
      const href = screen.getByRole('link', { name: /abrir en google maps/i }).getAttribute('href') ?? '';
      const url = new URL(href);
      expect(url.searchParams.get('origin')).toBe(baseTrip.pickupAddress);
      expect(url.searchParams.get('destination')).toBe(baseTrip.dropoffAddress);
      expect(href).not.toContain('NaN');
      expect(url.searchParams.get('origin')).not.toBe('0,0');
    });

    it('sin Map ID configurado los dos pines se dibujan con Marker clásico (AdvancedMarker exige Map ID)', () => {
      mockPublicMapId = '';
      render(<TripCourierView trip={baseTrip} />);

      expect(screen.getByTestId('mock-google-map')).toBeDefined();
      expect(screen.queryByTestId('mock-advanced-marker')).toBeNull();
      const legacy = screen.getAllByTestId('mock-legacy-marker');
      expect(legacy).toHaveLength(2);
      const positions = legacy.map((m) => ({
        lat: Number(m.getAttribute('data-lat')),
        lng: Number(m.getAttribute('data-lng')),
      }));
      expect(positions).toContainEqual({ lat: baseTrip.pickupLat, lng: baseTrip.pickupLng });
      expect(positions).toContainEqual({ lat: baseTrip.dropoffLat, lng: baseTrip.dropoffLng });
    });

    it('sin distancia calculada dice «Distancia no calculada» y no muestra ningún valor en km', () => {
      render(<TripCourierView trip={{ ...baseTrip, routeDistanceM: null }} />);

      const distance = screen.getByTestId('route-map-distance');
      expect(distance.textContent).toBe('Distancia no calculada');
      expect(screen.getByTestId('trip-route-map').textContent).not.toMatch(/\bkm\b/);
    });

    it('multi-drop con una entrega sin pin: no dibuja un recorrido parcial y Google Maps incluye todas las entregas en orden', () => {
      const dropTemplate: NonNullable<TripDetails['drops']>[number] = {
        id: '00000000-0000-4000-8000-0000000000d1',
        position: 1,
        dropoffZoneName: 'Centro',
        dropoffAddress: 'Mitre 10, Aguilares',
        recipientName: 'Cliente A',
        recipientPhone: '3865100000',
        deliveryNotes: null,
        cashChangeAmount: null,
        packageType: 'chico',
        recipientPaymentMethod: 'transfer',
        needsChange: false,
        approxDistanceM: null,
        status: 'pending',
        deliveredAt: null,
        failedReason: null,
        dropoffLat: -27.43,
        dropoffLng: -65.61,
      };
      const multiTrip: TripDetails = {
        ...baseTrip,
        dropsCount: 2,
        drops: [
          dropTemplate,
          {
            ...dropTemplate,
            id: '00000000-0000-4000-8000-0000000000d2',
            position: 2,
            dropoffZoneName: 'Norte',
            dropoffAddress: 'Mitre 20, Aguilares',
            recipientName: 'Cliente B',
            recipientPhone: '3865200000',
            dropoffLat: null,
            dropoffLng: null,
          },
        ],
      };
      render(<TripCourierView trip={multiTrip} />);

      expect(screen.getByTestId('route-map-fallback')).toBeDefined();
      expect(screen.queryByTestId('mock-route-polyline')).toBeNull();
      expect(screen.getByTestId('route-map-missing-points').textContent).toMatch(/entrega 2/i);
      expect(screen.getByTestId('route-map-missing-points').textContent).not.toMatch(/entrega 1/i);

      const href = screen.getByRole('link', { name: /abrir en google maps/i }).getAttribute('href') ?? '';
      const url = new URL(href);
      expect(url.searchParams.get('origin')).toBe(`${baseTrip.pickupLat},${baseTrip.pickupLng}`);
      expect(url.searchParams.get('waypoints')).toBe('-27.43,-65.61');
      expect(url.searchParams.get('destination')).toBe('Mitre 20, Aguilares');
    });

    it('una entrega intermedia sin pin viaja como dirección escrita en waypoints, sin saltearla', () => {
      const plan = buildTripRoutePlan({
        pickupAddress: 'San Martín 450, Centro',
        pickupZoneName: 'Centro',
        pickupLat: -27.4333,
        pickupLng: -65.6167,
        dropoffAddress: 'Mitre 10, Aguilares',
        dropoffZoneName: 'Centro',
        drops: [
          { position: 2, dropoffAddress: 'Mitre 20, Aguilares', dropoffZoneName: 'Norte', dropoffLat: -27.42, dropoffLng: -65.6 },
          { position: 1, dropoffAddress: 'Mitre 10, Aguilares', dropoffZoneName: 'Centro', dropoffLat: null, dropoffLng: null },
        ],
      });

      expect(plan.canDrawMap).toBe(false);
      expect(plan.missing.map((stop) => stop.label)).toEqual(['Entrega 1']);
      expect(plan.navigationLegs).toHaveLength(1);
      const url = new URL(plan.navigationLegs[0]?.url ?? '');
      expect(url.searchParams.get('origin')).toBe('-27.4333,-65.6167');
      expect(url.searchParams.get('waypoints')).toBe('Mitre 10, Aguilares');
      expect(url.searchParams.get('destination')).toBe('-27.42,-65.6');
    });

    it('cuando Google Maps falla con coordenadas válidas el fallback lo dice y no lo confunde con falta de ubicación', () => {
      mockLoadingStatus = 'FAILED';
      render(<TripCourierView trip={baseTrip} />);

      const fallback = screen.getByTestId('route-map-fallback');
      expect(fallback.textContent).toMatch(/no pudimos conectar con google maps/i);
      expect(fallback.textContent).not.toMatch(/sin ubicación exacta/i);
      expect(screen.queryByTestId('route-map-missing-points')).toBeNull();
    });
  });

  describe('6. PR386-H01 — Navegación en tramos: ≤3 paradas intermedias y ≤2048 caracteres por enlace', () => {
    function dropCoordinate(position: number) {
      return { lat: Number((-27.44 + position * 0.004).toFixed(4)), lng: Number((-65.63 + position * 0.003).toFixed(4)) };
    }

    function routeInput(
      positions: readonly number[],
      options: {
        address?: (position: number) => string;
        withoutCoordinates?: readonly number[];
        pickupAddress?: string;
      } = {}
    ): TripRouteInput {
      const address = options.address ?? ((position: number) => `Calle ${position} 100, Aguilares`);
      return {
        pickupAddress: options.pickupAddress ?? 'San Martín 450, Aguilares',
        pickupZoneName: 'Centro',
        pickupLat: -27.4333,
        pickupLng: -65.6167,
        dropoffAddress: address(1),
        dropoffZoneName: 'Centro',
        drops: positions.map((position) => {
          const missing = options.withoutCoordinates?.includes(position) ?? false;
          const coordinate = dropCoordinate(position);
          return {
            position,
            dropoffAddress: address(position),
            dropoffZoneName: 'Centro',
            dropoffLat: missing ? null : coordinate.lat,
            dropoffLng: missing ? null : coordinate.lng,
          };
        }),
      };
    }

    function urlStops(url: string): string[] {
      const params = new URL(url).searchParams;
      const waypoints = params.get('waypoints');
      return [
        params.get('origin') ?? '',
        ...(waypoints ? waypoints.split('|') : []),
        params.get('destination') ?? '',
      ];
    }

    /** Verifica cada tramo contra el recorrido completo esperado y devuelve las URLs. */
    function expectContinuousLegs(plan: TripRoutePlan, expectedLabels: readonly string[]): string[] {
      const legs = plan.navigationLegs;
      expect(legs.length).toBeGreaterThan(0);
      const urls: string[] = [];
      legs.forEach((leg, index) => {
        expect(leg.stops.length).toBeGreaterThanOrEqual(2);
        expect(leg.stops.length - 2).toBeLessThanOrEqual(MAX_NAVIGATION_WAYPOINTS);
        if (index > 0) {
          expect(leg.stops[0]).toBe(legs[index - 1]?.stops.at(-1));
        }
        expect(leg.url).not.toBeNull();
        const url = leg.url ?? '';
        expect(url.length).toBeLessThanOrEqual(MAX_NAVIGATION_URL_LENGTH);
        expect(new URL(url).origin + new URL(url).pathname).toBe('https://www.google.com/maps/dir/');
        expect(urlStops(url).length - 2).toBeLessThanOrEqual(MAX_NAVIGATION_WAYPOINTS);
        // La URL lleva exactamente las paradas del tramo: coordenada válida o dirección escrita íntegra
        expect(urlStops(url)).toEqual(
          leg.stops.map((stop) =>
            stop.coordinate ? `${stop.coordinate.lat},${stop.coordinate.lng}` : stop.address
          )
        );
        urls.push(url);
      });
      const sequence = legs.flatMap((leg, index) =>
        (index === 0 ? leg.stops : leg.stops.slice(1)).map((stop) => stop.label)
      );
      expect(sequence).toEqual(expectedLabels);
      return urls;
    }

    const labels = (n: number) =>
      n === 1 ? ['Retiro', 'Entrega'] : ['Retiro', ...Array.from({ length: n }, (_, i) => `Entrega ${i + 1}`)];

    it('1 entrega: un solo enlace sin paradas intermedias', () => {
      const plan = buildTripRoutePlan(routeInput([1]));
      const urls = expectContinuousLegs(plan, labels(1));
      expect(urls).toHaveLength(1);
      expect(new URL(urls[0] ?? '').searchParams.get('waypoints')).toBeNull();
    });

    it('4 entregas: un solo enlace con exactamente 3 paradas intermedias', () => {
      const plan = buildTripRoutePlan(routeInput([1, 2, 3, 4]));
      const urls = expectContinuousLegs(plan, labels(4));
      expect(urls).toHaveLength(1);
      expect(urlStops(urls[0] ?? '')).toHaveLength(5);
    });

    it('5 entregas: tramo 1 retiro→entrega 4 por 1/2/3 y tramo 2 entrega 4→entrega 5', () => {
      const plan = buildTripRoutePlan(routeInput([1, 2, 3, 4, 5]));
      expectContinuousLegs(plan, labels(5));
      expect(plan.navigationLegs.map((leg) => leg.stops.map((stop) => stop.label))).toEqual([
        ['Retiro', 'Entrega 1', 'Entrega 2', 'Entrega 3', 'Entrega 4'],
        ['Entrega 4', 'Entrega 5'],
      ]);
    });

    it('8 entregas: dos tramos que cubren las 8 en orden repitiendo la parada fronteriza', () => {
      const plan = buildTripRoutePlan(routeInput([1, 2, 3, 4, 5, 6, 7, 8]));
      expectContinuousLegs(plan, labels(8));
      expect(plan.navigationLegs.map((leg) => leg.stops.map((stop) => stop.label))).toEqual([
        ['Retiro', 'Entrega 1', 'Entrega 2', 'Entrega 3', 'Entrega 4'],
        ['Entrega 4', 'Entrega 5', 'Entrega 6', 'Entrega 7', 'Entrega 8'],
      ]);
    });

    it('entradas desordenadas: los tramos siguen el orden canónico de position', () => {
      const plan = buildTripRoutePlan(routeInput([3, 1, 5, 2, 4]));
      expectContinuousLegs(plan, labels(5));
    });

    it('entrega intermedia sin coordenada: viaja como dirección escrita y la continuidad se mantiene', () => {
      const plan = buildTripRoutePlan(routeInput([1, 2, 3, 4, 5], { withoutCoordinates: [2, 4] }));
      const urls = expectContinuousLegs(plan, labels(5));
      expect(urlStops(urls[0] ?? '')).toContain('Calle 2 100, Aguilares');
      expect(urlStops(urls[0] ?? '').at(-1)).toBe('Calle 4 100, Aguilares');
      expect(urlStops(urls[1] ?? '')[0]).toBe('Calle 4 100, Aguilares');
    });

    it('direcciones largas con acentos: subdivide por largo sin recortar ni perder paradas', () => {
      const longAddress = (position: number) => `${'é'.repeat(120)} ${position}`;
      const plan = buildTripRoutePlan(
        routeInput([1, 2, 3, 4, 5], {
          address: longAddress,
          withoutCoordinates: [1, 2, 3, 4, 5],
          pickupAddress: longAddress(0),
        })
      );
      const urls = expectContinuousLegs(plan, labels(5));
      // Con el largo, cada enlace admite menos paradas que el límite de waypoints
      expect(urls.length).toBeGreaterThan(2);
      for (const url of urls) {
        for (const stop of urlStops(url).filter((value) => !value.includes(','))) {
          expect(stop).toMatch(/^é{120} \d$/);
        }
      }
    });

    it('si ni el par origen/destino entra en 2048 caracteres el tramo queda manual (sin URL) y sin truncar', () => {
      const huge = 'Á'.repeat(200);
      const plan = buildTripRoutePlan({
        pickupAddress: huge,
        pickupZoneName: 'Centro',
        pickupLat: null,
        pickupLng: null,
        dropoffAddress: 'Ä'.repeat(200),
        dropoffZoneName: 'Centro',
      });
      expect(plan.navigationLegs).toHaveLength(1);
      expect(plan.navigationLegs[0]?.url).toBeNull();
      expect(plan.navigationLegs[0]?.stops.map((stop) => stop.address)).toEqual([
        huge,
        'Ä'.repeat(200),
      ]);
    });

    function tripDrops(count: number): NonNullable<TripDetails['drops']> {
      return Array.from({ length: count }, (_, index) => {
        const position = index + 1;
        const coordinate = dropCoordinate(position);
        return {
          id: `00000000-0000-4000-8000-0000000001${String(position).padStart(2, '0')}`,
          position,
          dropoffZoneName: 'Centro',
          dropoffAddress: `Calle ${position} 100, Aguilares`,
          recipientName: `Cliente ${position}`,
          recipientPhone: '3865100000',
          deliveryNotes: null,
          cashChangeAmount: null,
          packageType: 'chico',
          recipientPaymentMethod: 'transfer',
          needsChange: false,
          approxDistanceM: null,
          status: 'pending',
          deliveredAt: null,
          failedReason: null,
          dropoffLat: coordinate.lat,
          dropoffLng: coordinate.lng,
        };
      });
    }

    it('R07 con 5 entregas muestra «Abrir tramo 1 de 2» y «Abrir tramo 2 de 2» con enlaces seguros', () => {
      render(<TripCourierView trip={{ ...baseTrip, dropsCount: 5, drops: tripDrops(5) }} />);

      expect(screen.queryByRole('link', { name: /abrir en google maps/i })).toBeNull();
      const first = screen.getByRole('link', { name: /abrir tramo 1 de 2/i });
      const second = screen.getByRole('link', { name: /abrir tramo 2 de 2/i });
      for (const link of [first, second]) {
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toContain('noopener');
        expect(link.getAttribute('rel')).toContain('noreferrer');
        expect((link.getAttribute('href') ?? '').length).toBeLessThanOrEqual(MAX_NAVIGATION_URL_LENGTH);
      }
      expect(first.textContent).toContain('Retiro → Entrega 1 → Entrega 2 → Entrega 3 → Entrega 4');
      expect(second.textContent).toContain('Entrega 4 → Entrega 5');
      expect(urlStops(second.getAttribute('href') ?? '')).toHaveLength(2);
    });

    it('R07 con un tramo no navegable muestra instrucciones manuales sin href', () => {
      const huge = 'Á'.repeat(200);
      render(
        <TripCourierView
          trip={{
            ...baseTrip,
            pickupAddress: huge,
            dropoffAddress: 'Ä'.repeat(200),
            pickupLat: null,
            pickupLng: null,
            dropoffLat: null,
            dropoffLng: null,
          }}
        />
      );

      expect(screen.queryByRole('link', { name: /google maps|tramo/i })).toBeNull();
      const manual = screen.getByTestId('route-navigation-manual-leg');
      expect(manual.textContent).toMatch(/demasiado largas/i);
      expect(manual.textContent).toContain(huge);
    });

    it('C06 (comercio) con 5 entregas no expone enlaces de navegación externa', () => {
      render(<TripMerchantView trip={{ ...baseTrip, dropsCount: 5, drops: tripDrops(5) }} />);
      expect(screen.queryByRole('link', { name: /google maps|tramo/i })).toBeNull();
    });
  });

  describe('7. PR386-H02 — El mapa encuadra todos los pines con fitBounds', () => {
    it('ajusta los límites a los extremos del área de Aguilares (lat −27.48 y −27.38)', () => {
      render(
        <TripCourierView
          trip={{
            ...baseTrip,
            pickupLat: -27.48,
            pickupLng: -65.62,
            dropoffLat: -27.38,
            dropoffLng: -65.6,
          }}
        />
      );

      expect(screen.getByTestId('mock-google-map')).toBeDefined();
      expect(mockFitBounds).toHaveBeenCalled();
      expect(mockFitBounds).toHaveBeenLastCalledWith(
        { north: -27.38, south: -27.48, east: -65.6, west: -65.62 },
        expect.any(Number)
      );
    });

    it('con 5 entregas los límites contienen el retiro y todas las entregas; al cambiar las entregas se reajusta', () => {
      const drops = [
        { lat: -27.47, lng: -65.64 },
        { lat: -27.45, lng: -65.62 },
        { lat: -27.43, lng: -65.6 },
        { lat: -27.41, lng: -65.59 },
        { lat: -27.39, lng: -65.585 },
      ];
      const makeTrip = (points: typeof drops): TripDetails => ({
        ...baseTrip,
        dropsCount: points.length,
        drops: points.map((point, index) => ({
          id: `00000000-0000-4000-8000-0000000002${String(index + 1).padStart(2, '0')}`,
          position: index + 1,
          dropoffZoneName: 'Centro',
          dropoffAddress: `Calle ${index + 1}, Aguilares`,
          recipientName: `Cliente ${index + 1}`,
          recipientPhone: '3865100000',
          deliveryNotes: null,
          cashChangeAmount: null,
          packageType: 'chico',
          recipientPaymentMethod: 'transfer',
          needsChange: false,
          approxDistanceM: null,
          status: 'pending',
          deliveredAt: null,
          failedReason: null,
          dropoffLat: point.lat,
          dropoffLng: point.lng,
        })),
      });

      const { rerender } = render(<TripCourierView trip={makeTrip(drops)} />);
      expect(mockFitBounds).toHaveBeenLastCalledWith(
        { north: -27.39, south: -27.47, east: -65.585, west: -65.64 },
        expect.any(Number)
      );

      const callsBefore = mockFitBounds.mock.calls.length;
      rerender(<TripCourierView trip={makeTrip(drops.slice(0, 2))} />);
      expect(mockFitBounds.mock.calls.length).toBeGreaterThan(callsBefore);
      expect(mockFitBounds).toHaveBeenLastCalledWith(
        { north: -27.4333, south: -27.47, east: -65.6167, west: -65.64 },
        expect.any(Number)
      );
    });

    it('con puntos coincidentes encuadra con margen mínimo que contiene el punto (sin zoom extremo)', () => {
      render(
        <TripCourierView
          trip={{ ...baseTrip, dropoffLat: baseTrip.pickupLat, dropoffLng: baseTrip.pickupLng }}
        />
      );

      expect(mockFitBounds).toHaveBeenCalled();
      const [bounds] = mockFitBounds.mock.lastCall as [
        { north: number; south: number; east: number; west: number },
        number,
      ];
      expect(bounds.north - bounds.south).toBeGreaterThanOrEqual(0.0019);
      expect(bounds.east - bounds.west).toBeGreaterThanOrEqual(0.0019);
      expect(bounds.north).toBeGreaterThan(baseTrip.pickupLat ?? 0);
      expect(bounds.south).toBeLessThan(baseTrip.pickupLat ?? 0);
      expect(bounds.east).toBeGreaterThan(baseTrip.pickupLng ?? 0);
      expect(bounds.west).toBeLessThan(baseTrip.pickupLng ?? 0);
    });

    it('offline o con el SDK fallido no hay mapa ni ajuste de cámara', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
      const { unmount } = render(<TripCourierView trip={baseTrip} />);
      expect(screen.getByTestId('route-map-fallback')).toBeDefined();
      expect(mockFitBounds).not.toHaveBeenCalled();
      unmount();

      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
      mockLoadingStatus = 'FAILED';
      render(<TripCourierView trip={baseTrip} />);
      expect(screen.getByTestId('route-map-fallback')).toBeDefined();
      expect(mockFitBounds).not.toHaveBeenCalled();
    });
  });

  describe('8. T-377 — Recorrido por calles con Route.computeRoutes y fallbacks excluyentes', () => {
    const STREET_FALLBACK_TEXT = 'Línea recta orientativa; la ruta por calles no está disponible';

    type LatLngLike = { readonly lat: number; readonly lng: number };
    type ComputeRoutesRequestLike = {
      origin: LatLngLike;
      destination: LatLngLike;
      intermediates: Array<{ location: LatLngLike }>;
      travelMode: string;
      fields: string[];
      optimizeWaypointOrder: boolean;
    };

    /** Igual que google.maps.LatLngAltitude: lat/lng son getters, no propiedades propias. */
    function latLngAltitude(lat: number, lng: number) {
      return {
        get lat() {
          return lat;
        },
        get lng() {
          return lng;
        },
        get altitude() {
          return 0;
        },
      };
    }

    function installRoutesLibrary(
      computeRoutes: (request: ComputeRoutesRequestLike) => Promise<unknown>
    ) {
      const spy = vi.fn(computeRoutes);
      mockRoutesLibrary = { Route: { computeRoutes: spy } };
      return spy;
    }

    const STREET_PATH = [
      latLngAltitude(-27.4333, -65.6167),
      latLngAltitude(-27.4301, -65.6175),
      latLngAltitude(-27.4285, -65.6131),
      latLngAltitude(-27.425, -65.61),
    ];
    const STREET_PATH_LITERALS = STREET_PATH.map((point) => ({ lat: point.lat, lng: point.lng }));
    const STRAIGHT_PATH = [
      { lat: baseTrip.pickupLat, lng: baseTrip.pickupLng },
      { lat: baseTrip.dropoffLat, lng: baseTrip.dropoffLng },
    ];

    function polylinePaths(): unknown[] {
      return screen
        .queryAllByTestId('mock-route-polyline')
        .map((node) => JSON.parse(node.getAttribute('data-path') || '[]'));
    }

    async function flushRoutes() {
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
    }

    function makeDropsTrip(
      points: ReadonlyArray<{ lat: number | null; lng: number | null; position: number }>
    ): TripDetails {
      return {
        ...baseTrip,
        dropsCount: points.length,
        drops: points.map((point) => ({
          id: `00000000-0000-4000-8000-0000000003${String(point.position).padStart(2, '0')}`,
          position: point.position,
          dropoffZoneName: 'Centro',
          dropoffAddress: `Calle ${point.position}, Aguilares`,
          recipientName: `Cliente ${point.position}`,
          recipientPhone: '3865100000',
          deliveryNotes: null,
          cashChangeAmount: null,
          packageType: 'chico',
          recipientPaymentMethod: 'transfer',
          needsChange: false,
          approxDistanceM: null,
          status: 'pending',
          deliveredAt: null,
          failedReason: null,
          dropoffLat: point.lat,
          dropoffLng: point.lng,
        })),
      };
    }

    it('ruta OK: llama computeRoutes una vez con el contrato exacto y dibuja la geometría por calles', async () => {
      const computeRoutes = installRoutesLibrary(async () => ({
        routes: [{ path: STREET_PATH }],
        fallbackInfo: null,
        geocodingResults: null,
      }));

      render(<TripCourierView trip={baseTrip} />);
      await flushRoutes();

      expect(computeRoutes).toHaveBeenCalledTimes(1);
      const [request] = computeRoutes.mock.calls[0] as [ComputeRoutesRequestLike];
      expect(request).toEqual({
        origin: { lat: baseTrip.pickupLat, lng: baseTrip.pickupLng },
        destination: { lat: baseTrip.dropoffLat, lng: baseTrip.dropoffLng },
        intermediates: [],
        travelMode: 'DRIVING',
        fields: ['path'],
        optimizeWaypointOrder: false,
      });

      expect(polylinePaths()).toEqual([STREET_PATH_LITERALS]);
      expect(screen.queryByText(STREET_FALLBACK_TEXT)).toBeNull();
      // La distancia sigue siendo la del servidor (D15), no la de la ruta.
      expect(screen.getByTestId('route-map-distance').textContent).toMatch(/≈ 2,5 km/);
    });

    it('ruta OK en C06: el pie describe el recorrido por calles con text-primary-dark', async () => {
      installRoutesLibrary(async () => ({ routes: [{ path: STREET_PATH }] }));

      render(<TripMerchantView trip={baseTrip} />);
      await flushRoutes();

      const routeNote = screen.getByText('Recorrido orientativo por calles');
      expect(routeNote.classList.contains('text-primary-dark')).toBe(true);
      expect(screen.queryByText('Línea recta orientativa')).toBeNull();
    });

    it('el encuadre incluye la geometría por calles aunque salga del rectángulo de los pines', async () => {
      const detour = [
        latLngAltitude(-27.4333, -65.6167),
        latLngAltitude(-27.44, -65.63),
        latLngAltitude(-27.425, -65.61),
      ];
      installRoutesLibrary(async () => ({ routes: [{ path: detour }] }));

      render(<TripCourierView trip={baseTrip} />);
      await flushRoutes();

      expect(mockFitBounds).toHaveBeenLastCalledWith(
        { north: -27.425, south: -27.44, east: -65.61, west: -65.63 },
        expect.any(Number)
      );
    });

    it('varias entregas: origen = retiro, destino = última entrega e intermedias en orden de position', async () => {
      const computeRoutes = installRoutesLibrary(async () => ({ routes: [{ path: STREET_PATH }] }));
      // Desordenadas a propósito: el orden lo fija `position`, no el arreglo.
      const trip = makeDropsTrip([
        { lat: -27.41, lng: -65.59, position: 3 },
        { lat: -27.45, lng: -65.62, position: 1 },
        { lat: -27.43, lng: -65.6, position: 2 },
      ]);

      render(<TripCourierView trip={trip} />);
      await flushRoutes();

      expect(computeRoutes).toHaveBeenCalledTimes(1);
      const [request] = computeRoutes.mock.calls[0] as [ComputeRoutesRequestLike];
      expect(request.origin).toEqual({ lat: baseTrip.pickupLat, lng: baseTrip.pickupLng });
      expect(request.intermediates).toEqual([
        { location: { lat: -27.45, lng: -65.62 } },
        { location: { lat: -27.43, lng: -65.6 } },
      ]);
      expect(request.destination).toEqual({ lat: -27.41, lng: -65.59 });
      expect(request.optimizeWaypointOrder).toBe(false);
      expect(polylinePaths()).toEqual([STREET_PATH_LITERALS]);
    });

    it('error de la API: línea recta con el texto de fallback', async () => {
      const computeRoutes = installRoutesLibrary(async () => {
        throw new Error('REQUEST_DENIED');
      });

      render(<TripCourierView trip={baseTrip} />);
      await flushRoutes();

      expect(computeRoutes).toHaveBeenCalledTimes(1);
      expect(polylinePaths()).toEqual([STRAIGHT_PATH]);
      expect(screen.getByText(STREET_FALLBACK_TEXT)).toBeDefined();
      expect(screen.getByRole('link', { name: /abrir en google maps/i })).toBeDefined();
    });

    it('sin ruta: routes vacío o sin path válido cae a la línea recta con el texto', async () => {
      installRoutesLibrary(async () => ({ routes: [] }));
      const { unmount } = render(<TripCourierView trip={baseTrip} />);
      await flushRoutes();
      expect(polylinePaths()).toEqual([STRAIGHT_PATH]);
      expect(screen.getByText(STREET_FALLBACK_TEXT)).toBeDefined();
      unmount();

      installRoutesLibrary(async () => ({
        routes: [{ path: [latLngAltitude(-27.4333, -65.6167), latLngAltitude(Number.NaN, -65.61)] }],
      }));
      render(<TripCourierView trip={baseTrip} />);
      await flushRoutes();
      expect(polylinePaths()).toEqual([STRAIGHT_PATH]);
      expect(screen.getByText(STREET_FALLBACK_TEXT)).toBeDefined();
    });

    it('sin biblioteca: si routes no carga, línea recta y, vencida la espera, el texto de fallback', () => {
      vi.useFakeTimers();
      try {
        mockRoutesLibrary = null;
        render(<TripCourierView trip={baseTrip} />);

        // Mientras carga se ve la línea recta, sin afirmar todavía que la ruta falló.
        expect(polylinePaths()).toEqual([STRAIGHT_PATH]);
        expect(screen.queryByText(STREET_FALLBACK_TEXT)).toBeNull();

        act(() => {
          vi.advanceTimersByTime(15_000);
        });
        expect(polylinePaths()).toEqual([STRAIGHT_PATH]);
        expect(screen.getByText(STREET_FALLBACK_TEXT)).toBeDefined();
      } finally {
        vi.useRealTimers();
      }
    });

    it('biblioteca sin Route.computeRoutes: línea recta con el texto y sin romper la vista', async () => {
      mockRoutesLibrary = {};
      render(<TripCourierView trip={baseTrip} />);
      await flushRoutes();

      expect(polylinePaths()).toEqual([STRAIGHT_PATH]);
      expect(screen.getByText(STREET_FALLBACK_TEXT)).toBeDefined();
    });

    it('más de 10 entregas intermedias: no llama a la API y usa la línea recta con el texto', async () => {
      const computeRoutes = installRoutesLibrary(async () => ({ routes: [{ path: STREET_PATH }] }));
      const points = Array.from({ length: 12 }, (_, index) => ({
        lat: -27.47 + index * 0.007,
        lng: -65.64 + index * 0.004,
        position: index + 1,
      }));

      render(<TripCourierView trip={makeDropsTrip(points)} />);
      await flushRoutes();

      expect(computeRoutes).not.toHaveBeenCalled();
      const [path] = polylinePaths() as [Array<{ lat: number; lng: number }>];
      expect(path).toHaveLength(13);
      expect(screen.getByText(STREET_FALLBACK_TEXT)).toBeDefined();
    });

    it('con 10 entregas intermedias (11 entregas) todavía calcula la ruta', async () => {
      const computeRoutes = installRoutesLibrary(async () => ({ routes: [{ path: STREET_PATH }] }));
      const points = Array.from({ length: 11 }, (_, index) => ({
        lat: -27.47 + index * 0.007,
        lng: -65.64 + index * 0.004,
        position: index + 1,
      }));

      render(<TripCourierView trip={makeDropsTrip(points)} />);
      await flushRoutes();

      expect(computeRoutes).toHaveBeenCalledTimes(1);
      const [request] = computeRoutes.mock.calls[0] as [ComputeRoutesRequestLike];
      expect(request.intermediates).toHaveLength(10);
    });

    it('rerender con los mismos puntos no repite la llamada', async () => {
      const computeRoutes = installRoutesLibrary(async () => ({ routes: [{ path: STREET_PATH }] }));

      // Un refresco del viaje trae objetos y arreglos nuevos con los mismos puntos: no es una secuencia nueva.
      const points = [
        { lat: -27.45, lng: -65.62, position: 1 },
        { lat: -27.41, lng: -65.59, position: 2 },
      ];
      const { rerender } = render(<TripCourierView trip={makeDropsTrip(points)} />);
      await flushRoutes();
      rerender(<TripCourierView trip={makeDropsTrip(points.map((point) => ({ ...point })))} />);
      rerender(<TripCourierView trip={{ ...makeDropsTrip(points), courierName: 'Otro nombre' }} />);
      await flushRoutes();

      expect(computeRoutes).toHaveBeenCalledTimes(1);
      expect(polylinePaths()).toEqual([STREET_PATH_LITERALS]);
    });

    it('respuesta tardía: si cambian los puntos se ignora la respuesta vieja y se dibuja la nueva', async () => {
      const resolvers: Array<(value: unknown) => void> = [];
      const computeRoutes = installRoutesLibrary(
        () =>
          new Promise((resolve) => {
            resolvers.push(resolve);
          })
      );
      const movedTrip = { ...baseTrip, dropoffLat: -27.41, dropoffLng: -65.59 };
      // Con un punto intermedio para que no coincida con la línea recta del fallback.
      const newPath = [
        latLngAltitude(-27.4333, -65.6167),
        latLngAltitude(-27.42, -65.605),
        latLngAltitude(-27.41, -65.59),
      ];

      const { rerender } = render(<TripCourierView trip={baseTrip} />);
      await flushRoutes();
      rerender(<TripCourierView trip={movedTrip} />);
      await flushRoutes();
      expect(computeRoutes).toHaveBeenCalledTimes(2);

      // Llega primero la respuesta nueva y después la vieja: la vieja no la pisa.
      await act(async () => {
        resolvers[1]?.({ routes: [{ path: newPath }] });
      });
      await act(async () => {
        resolvers[0]?.({ routes: [{ path: STREET_PATH }] });
      });

      expect(polylinePaths()).toEqual([
        [
          { lat: -27.4333, lng: -65.6167 },
          { lat: -27.42, lng: -65.605 },
          { lat: -27.41, lng: -65.59 },
        ],
      ]);
      expect(screen.queryByText(STREET_FALLBACK_TEXT)).toBeNull();
    });

    it('respuesta tardía tras desmontar: no actualiza nada ni avisa errores de React', async () => {
      let resolveLate: ((value: unknown) => void) | undefined;
      installRoutesLibrary(
        () =>
          new Promise((resolve) => {
            resolveLate = resolve;
          })
      );
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { unmount } = render(<TripCourierView trip={baseTrip} />);
      await flushRoutes();
      unmount();
      await act(async () => {
        resolveLate?.({ routes: [{ path: STREET_PATH }] });
      });

      expect(screen.queryByTestId('mock-route-polyline')).toBeNull();
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('sin pin en retiro, entrega final o entrega intermedia: sin Polyline y sin llamar a la API (T-363)', async () => {
      const computeRoutes = installRoutesLibrary(async () => ({ routes: [{ path: STREET_PATH }] }));

      const { unmount: u1 } = render(<TripCourierView trip={{ ...baseTrip, pickupLat: null }} />);
      await flushRoutes();
      expect(screen.queryByTestId('mock-route-polyline')).toBeNull();
      expect(screen.getByTestId('route-map-fallback')).toBeDefined();
      u1();

      const { unmount: u2 } = render(<TripCourierView trip={{ ...baseTrip, dropoffLng: null }} />);
      await flushRoutes();
      expect(screen.queryByTestId('mock-route-polyline')).toBeNull();
      u2();

      render(
        <TripCourierView
          trip={makeDropsTrip([
            { lat: -27.45, lng: -65.62, position: 1 },
            { lat: null, lng: null, position: 2 },
            { lat: -27.41, lng: -65.59, position: 3 },
          ])}
        />
      );
      await flushRoutes();
      expect(screen.queryByTestId('mock-route-polyline')).toBeNull();
      expect(screen.getByTestId('route-map-missing-points').textContent).toContain('entrega 2');

      expect(computeRoutes).not.toHaveBeenCalled();
      expect(screen.queryByText(STREET_FALLBACK_TEXT)).toBeNull();
    });

    it('Maps JS no carga: se mantiene el fallback sin mapa y nunca se calcula la ruta', async () => {
      const computeRoutes = installRoutesLibrary(async () => ({ routes: [{ path: STREET_PATH }] }));
      mockLoadingStatus = 'FAILED';

      render(<TripCourierView trip={baseTrip} />);
      await flushRoutes();

      expect(screen.getByTestId('route-map-fallback')).toBeDefined();
      expect(screen.queryByTestId('mock-route-polyline')).toBeNull();
      expect(screen.queryByText(STREET_FALLBACK_TEXT)).toBeNull();
      expect(computeRoutes).not.toHaveBeenCalled();
    });
  });
});
