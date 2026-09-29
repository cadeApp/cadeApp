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
    packageType: 'small',
    recipientPaymentMethod: 'cash',
    needsChange: true,
    cashChangeAmount: 5000,
    notes: 'Frágil',
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
});
