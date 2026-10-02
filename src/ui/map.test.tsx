// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  MapPicker,
  AGUILARES_CENTER,
  AGUILARES_BOUNDS,
  isWithinAguilaresBounds,
  aguilaresCoordinatesSchema,
  type MapCoordinates,
} from './map';
import { MapSkeleton } from './map-skeleton';

// Configuración dinámica de mocks
let mockLoadingStatus = 'LOADED';
let mockPublicApiKey = 'test-google-maps-api-key';
let mockPublicMapId = 'test-map-id';

let capturedMapProps: {
  center?: MapCoordinates;
  defaultCenter?: MapCoordinates;
  style?: React.CSSProperties;
  onCameraChanged?: (ev: { detail: { center: { lat: number; lng: number } } }) => void;
  onClick?: (ev: { detail: { latLng: { lat: number; lng: number } | null } }) => void;
  disabled?: boolean;
  children?: React.ReactNode;
} | null = null;

let capturedAdvancedMarkerProps: {
  position?: MapCoordinates;
  draggable?: boolean;
  onDragEnd?: (ev: {
    latLng: {
      lat: number | (() => number);
      lng: number | (() => number);
    } | null;
  }) => void;
  title?: string;
  children?: React.ReactNode;
} | null = null;

let capturedLegacyMarkerProps: {
  position?: MapCoordinates;
  draggable?: boolean;
  onDragEnd?: (ev: {
    latLng: {
      lat: number | (() => number);
      lng: number | (() => number);
    } | null;
  }) => void;
  title?: string;
  children?: React.ReactNode;
} | null = null;

const getCapturedMarkerProps = () =>
  capturedAdvancedMarkerProps ?? capturedLegacyMarkerProps;

let mockPanTo = vi.fn();
let mockMapInstance = {
  panTo: mockPanTo,
  setCenter: vi.fn(),
};

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
  useMap: () => mockMapInstance,
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
  Map: (props: {
    center?: MapCoordinates;
    defaultCenter?: MapCoordinates;
    style?: React.CSSProperties;
    onCameraChanged?: (ev: { detail: { center: { lat: number; lng: number } } }) => void;
    onClick?: (ev: { detail: { latLng: { lat: number; lng: number } | null } }) => void;
    disabled?: boolean;
    children?: React.ReactNode;
  }) => {
    capturedMapProps = props;
    return <div data-testid="mock-google-map">{props.children}</div>;
  },
  Marker: (props: {
    position?: MapCoordinates;
    draggable?: boolean;
    onDragEnd?: (ev: {
      latLng: {
        lat: number | (() => number);
        lng: number | (() => number);
      } | null;
    }) => void;
    title?: string;
    children?: React.ReactNode;
  }) => {
    capturedLegacyMarkerProps = props;
    return <div data-testid="mock-legacy-marker">{props.children}</div>;
  },
  AdvancedMarker: (props: {
    position?: MapCoordinates;
    draggable?: boolean;
    onDragEnd?: (ev: {
      latLng: {
        lat: number | (() => number);
        lng: number | (() => number);
      } | null;
    }) => void;
    title?: string;
    children?: React.ReactNode;
  }) => {
    capturedAdvancedMarkerProps = props;
    return <div data-testid="mock-advanced-marker">{props.children}</div>;
  },
}));

describe('CC-014 · Contrato compartido de mapa src/ui/map.tsx', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    mockLoadingStatus = 'LOADED';
    mockPublicApiKey = 'test-google-maps-api-key';
    mockPublicMapId = 'test-map-id';
    capturedMapProps = null;
    capturedAdvancedMarkerProps = null;
    capturedLegacyMarkerProps = null;
    mockPanTo.mockClear();
    mockOnError = null;
    delete (window as unknown as { gm_authFailure?: () => void }).gm_authFailure;
  });

  beforeEach(() => {
    mockLoadingStatus = 'LOADED';
    mockPublicApiKey = 'test-google-maps-api-key';
    mockPublicMapId = 'test-map-id';
    capturedMapProps = null;
    capturedAdvancedMarkerProps = null;
    capturedLegacyMarkerProps = null;
    mockPanTo.mockClear();
    mockOnError = null;
    delete (window as unknown as { gm_authFailure?: () => void }).gm_authFailure;

    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  describe('1. Sincronización de posición ante cambios externos y GPS', () => {
    const ZONE_A: MapCoordinates = { lat: -27.4300, lng: -65.6150 };
    const ZONE_B: MapCoordinates = { lat: -27.4400, lng: -65.6200 };
    const VALUE_A: MapCoordinates = { lat: -27.4320, lng: -65.6160 };
    const VALUE_B: MapCoordinates = { lat: -27.4380, lng: -65.6190 };
    const GPS_COORDS: MapCoordinates = { lat: -27.4345, lng: -65.6175 };

    it('A. actualiza la posición del pin y sincroniza cámara cuando defaultZoneCenter cambia', () => {
      const { rerender } = render(<MapPicker defaultZoneCenter={ZONE_A} />);
      expect(getCapturedMarkerProps()?.position).toEqual(ZONE_A);

      rerender(<MapPicker defaultZoneCenter={ZONE_B} />);
      expect(getCapturedMarkerProps()?.position).toEqual(ZONE_B);
      expect(mockPanTo).toHaveBeenCalledWith(ZONE_B);
    });

    it('B. actualiza la posición del pin y sincroniza cámara cuando value externo cambia', () => {
      const { rerender } = render(<MapPicker value={VALUE_A} />);
      expect(getCapturedMarkerProps()?.position).toEqual(VALUE_A);

      rerender(<MapPicker value={VALUE_B} />);
      expect(getCapturedMarkerProps()?.position).toEqual(VALUE_B);
      expect(mockPanTo).toHaveBeenCalledWith(VALUE_B);
    });

    it('C. recentra la cámara y actualiza el pin cuando el GPS obtiene nueva ubicación', async () => {
      const onChange = vi.fn();
      const onLocationFound = vi.fn();

      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: vi.fn((success) =>
            success({
              coords: {
                latitude: GPS_COORDS.lat,
                longitude: GPS_COORDS.lng,
              },
            })
          ),
        },
        writable: true,
        configurable: true,
      });

      render(
        <MapPicker
          showLocationButton
          onChange={onChange}
          onLocationFound={onLocationFound}
        />
      );

      const btn = screen.getByRole('button', { name: /usar mi ubicación/i });
      fireEvent.click(btn);

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(GPS_COORDS);
        expect(onLocationFound).toHaveBeenCalledWith(GPS_COORDS);
      });

      expect(getCapturedMarkerProps()?.position).toEqual(GPS_COORDS);
      expect(mockPanTo).toHaveBeenCalledWith(GPS_COORDS);
    });
  });

  describe('2. H02 — Fallback graceful ante Google caído, sin key y offline', () => {
    it('muestra fallback cuando APILoadingStatus es FAILED con key válida y online', async () => {
      mockLoadingStatus = 'FAILED';

      render(<MapPicker value={AGUILARES_CENTER} />);

      await waitFor(() => {
        expect(screen.getByTestId('map-load-error-banner')).toBeDefined();
      });

      expect(screen.getByText(/no pudimos conectar con google maps/i)).toBeDefined();
      expect(screen.getByTestId('map-fallback')).toBeDefined();
      expect(screen.queryByTestId('mock-google-map')).toBeNull();
    });

    it('muestra fallback cuando APIProvider invoca onError directamente', async () => {
      render(<MapPicker value={AGUILARES_CENTER} />);

      expect(screen.getByTestId('mock-google-map')).toBeDefined();
      expect(mockOnError).toBeTypeOf('function');

      act(() => {
        mockOnError?.();
      });

      await waitFor(() => {
        expect(screen.getByTestId('map-load-error-banner')).toBeDefined();
      });
      expect(screen.queryByTestId('mock-google-map')).toBeNull();
    });

    it('muestra banner y fallback cuando no hay API key configurada', () => {
      mockPublicApiKey = '';

      render(<MapPicker value={AGUILARES_CENTER} />);

      expect(screen.getByTestId('map-no-key-banner')).toBeDefined();
      expect(screen.getByTestId('map-fallback')).toBeDefined();
      expect(screen.queryByTestId('mock-google-map')).toBeNull();
    });

    it('muestra banner offline cuando navigator.onLine es false', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      });

      render(<MapPicker value={AGUILARES_CENTER} />);

      expect(screen.getByTestId('map-offline-banner')).toBeDefined();
      expect(screen.getByText(/modo sin conexión/i)).toBeDefined();
      expect(screen.getByTestId('map-fallback')).toBeDefined();
      expect(screen.queryByTestId('mock-google-map')).toBeNull();
    });

    it('escucha eventos de online y offline dinámicos en window', () => {
      render(<MapPicker value={AGUILARES_CENTER} />);

      fireEvent(window, new Event('offline'));
      expect(screen.getByTestId('map-offline-banner')).toBeDefined();

      fireEvent(window, new Event('online'));
      expect(screen.queryByTestId('map-offline-banner')).toBeNull();
    });

    it('muestra fallback cuando Google Maps dispara window.gm_authFailure (billing, key inválida o referrer no autorizado)', async () => {
      render(<MapPicker value={AGUILARES_CENTER} />);

      expect(screen.getByTestId('mock-google-map')).toBeDefined();
      expect(typeof (window as unknown as { gm_authFailure?: () => void }).gm_authFailure).toBe('function');

      act(() => {
        (window as unknown as { gm_authFailure: () => void }).gm_authFailure();
      });

      await waitFor(() => {
        expect(screen.getByTestId('map-load-error-banner')).toBeDefined();
      });

      expect(screen.getByText(/no pudimos conectar con google maps/i)).toBeDefined();
      expect(screen.getByTestId('map-fallback')).toBeDefined();
      expect(screen.queryByTestId('mock-google-map')).toBeNull();
    });

    it('el fallback y banner no exponen la API key ni URLs técnicas de Google', async () => {
      render(<MapPicker value={AGUILARES_CENTER} />);

      act(() => {
        (window as unknown as { gm_authFailure?: () => void }).gm_authFailure?.();
      });

      await waitFor(() => {
        expect(screen.getByTestId('map-load-error-banner')).toBeDefined();
      });

      const pickerHtml = screen.getByTestId('map-picker').innerHTML;
      expect(pickerHtml).not.toContain(mockPublicApiKey);
      expect(pickerHtml).not.toContain('maps.googleapis.com');
      expect(pickerHtml).not.toContain('BillingNotEnabledMapError');
      expect(pickerHtml).not.toContain('RefererNotAllowedMapError');
    });

    it('handler previo + una instancia -> se preserva al desmontar', () => {
      const priorHandler = vi.fn();
      (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = priorHandler;

      const { unmount } = render(<MapPicker value={AGUILARES_CENTER} />);
      unmount();

      expect((window as unknown as { gm_authFailure?: () => void }).gm_authFailure).toBe(priorHandler);
    });

    it('dos MapPicker montados -> auth failure degrada ambos', async () => {
      render(
        <div>
          <MapPicker value={AGUILARES_CENTER} />
          <MapPicker value={{ lat: -27.44, lng: -65.62 }} />
        </div>
      );

      expect(screen.getAllByTestId('mock-google-map')).toHaveLength(2);

      act(() => {
        (window as unknown as { gm_authFailure: () => void }).gm_authFailure();
      });

      await waitFor(() => {
        expect(screen.getAllByTestId('map-load-error-banner')).toHaveLength(2);
      });

      expect(screen.getAllByTestId('map-fallback')).toHaveLength(2);
      expect(screen.queryByTestId('mock-google-map')).toBeNull();
    });

    it('desmontar primero la instancia A dejando B montada -> gm_authFailure sigue degradando B', async () => {
      function TwoPickers({ showA }: { showA: boolean }) {
        return (
          <div>
            {showA && (
              <div data-testid="container-a">
                <MapPicker value={AGUILARES_CENTER} />
              </div>
            )}
            <div data-testid="container-b">
              <MapPicker value={{ lat: -27.44, lng: -65.62 }} />
            </div>
          </div>
        );
      }

      const { rerender } = render(<TwoPickers showA={true} />);
      expect(screen.getAllByTestId('mock-google-map')).toHaveLength(2);

      // Desmontar A dejando B montada (no-LIFO)
      rerender(<TwoPickers showA={false} />);
      expect(screen.queryByTestId('container-a')).toBeNull();
      expect(screen.getByTestId('container-b')).toBeDefined();

      // Disparar gm_authFailure
      act(() => {
        (window as unknown as { gm_authFailure: () => void }).gm_authFailure();
      });

      // B debe degradar
      await waitFor(() => {
        expect(screen.getByTestId('map-load-error-banner')).toBeDefined();
      });
      expect(screen.getByTestId('map-fallback')).toBeDefined();
    });

    it('desmontar B después -> restaura el handler externo previo', () => {
      const priorHandler = vi.fn();
      (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = priorHandler;

      function TwoPickers({ showA, showB }: { showA: boolean; showB: boolean }) {
        return (
          <div>
            {showA && <MapPicker value={AGUILARES_CENTER} />}
            {showB && <MapPicker value={{ lat: -27.44, lng: -65.62 }} />}
          </div>
        );
      }

      const { rerender } = render(<TwoPickers showA={true} showB={true} />);
      // Desmontar A
      rerender(<TwoPickers showA={false} showB={true} />);
      // Desmontar B
      rerender(<TwoPickers showA={false} showB={false} />);

      expect((window as unknown as { gm_authFailure?: () => void }).gm_authFailure).toBe(priorHandler);
    });

    it('si otro código reemplaza el global después del bridge, el cleanup no debe pisar ese handler nuevo', () => {
      const priorHandler = vi.fn();
      (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = priorHandler;

      const { unmount } = render(<MapPicker value={AGUILARES_CENTER} />);

      const thirdPartyHandler = vi.fn();
      (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = thirdPartyHandler;

      unmount();

      expect((window as unknown as { gm_authFailure?: () => void }).gm_authFailure).toBe(thirdPartyHandler);
    });
  });

  describe('3. H02 — Errores y variantes de Geolocation', () => {
    it('muestra error y notifica onLocationError cuando navigator.geolocation es undefined', async () => {
      Object.defineProperty(navigator, 'geolocation', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const onLocationError = vi.fn();
      const onChange = vi.fn();

      render(
        <MapPicker
          showLocationButton
          onLocationError={onLocationError}
          onChange={onChange}
        />
      );

      const btn = screen.getByRole('button', { name: /usar mi ubicación/i });
      fireEvent.click(btn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
      });

      expect(screen.getByRole('alert').textContent).toMatch(/no está disponible en este dispositivo/i);
      expect(onLocationError).toHaveBeenCalledWith(
        expect.stringMatching(/no está disponible en este dispositivo/i)
      );
      expect(onChange).not.toHaveBeenCalled();
    });

    it('muestra error de permiso denegado cuando geolocation error code es 1', async () => {
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: vi.fn((_success, error) =>
            error({
              code: 1, // PERMISSION_DENIED
              message: 'User denied geolocation',
            })
          ),
        },
        writable: true,
        configurable: true,
      });

      const onLocationError = vi.fn();

      render(<MapPicker showLocationButton onLocationError={onLocationError} />);

      const btn = screen.getByRole('button', { name: /usar mi ubicación/i });
      fireEvent.click(btn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
      });

      expect(screen.getByRole('alert').textContent).toMatch(/permiso de ubicación denegado/i);
      expect(onLocationError).toHaveBeenCalledWith(
        expect.stringMatching(/permiso de ubicación denegado/i)
      );
    });

    it('muestra error genérico cuando geolocation falla con otro código (ej: code 2)', async () => {
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: vi.fn((_success, error) =>
            error({
              code: 2, // POSITION_UNAVAILABLE
              message: 'Position unavailable',
            })
          ),
        },
        writable: true,
        configurable: true,
      });

      const onLocationError = vi.fn();

      render(<MapPicker showLocationButton onLocationError={onLocationError} />);

      const btn = screen.getByRole('button', { name: /usar mi ubicación/i });
      fireEvent.click(btn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
      });

      expect(screen.getByRole('alert').textContent).toMatch(/no pudimos obtener tu ubicación actual/i);
      expect(onLocationError).toHaveBeenCalledWith(
        expect.stringMatching(/no pudimos obtener tu ubicación actual/i)
      );
    });

    it('muestra alerta si la geolocalización devuelve una ubicación fuera de Aguilares', async () => {
      const onChange = vi.fn();
      const onLocationError = vi.fn();
      const outOfBoundsCoords = { latitude: -26.83, longitude: -65.20 }; // San Miguel de Tucumán

      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: vi.fn((success) =>
            success({
              coords: outOfBoundsCoords,
            })
          ),
        },
        writable: true,
        configurable: true,
      });

      render(
        <MapPicker
          value={AGUILARES_CENTER}
          onChange={onChange}
          onLocationError={onLocationError}
          showLocationButton
        />
      );

      const btn = screen.getByRole('button', { name: /usar mi ubicación/i });
      fireEvent.click(btn);

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toMatch(/fuera de aguilares/i);
      });
      expect(onLocationError).toHaveBeenCalledWith(
        expect.stringMatching(/fuera de aguilares/i)
      );
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('4. H02 — Comportamiento con disabled=true', () => {
    it('desactiva interacciones, controles y atajos de teclado cuando disabled es true', () => {
      const onChange = vi.fn();

      render(
        <MapPicker
          value={AGUILARES_CENTER}
          onChange={onChange}
          disabled
          showLocationButton
        />
      );

      // Pin no arrastrable
      expect(getCapturedMarkerProps()?.draggable).toBe(false);

      // Botón GPS deshabilitado
      const gpsBtn = screen.getByRole('button', { name: /usar mi ubicación/i });
      expect(gpsBtn).toHaveProperty('disabled', true);

      // onCameraChanged ignorado
      act(() => {
        capturedMapProps?.onCameraChanged?.({
          detail: { center: { lat: -27.435, lng: -65.618 } },
        });
      });
      expect(onChange).not.toHaveBeenCalled();

      // onDragEnd ignorado cuando disabled
      act(() => {
        getCapturedMarkerProps()?.onDragEnd?.({
          latLng: { lat: -27.435, lng: -65.618 },
        });
      });
      expect(onChange).not.toHaveBeenCalled();

      // onClick ignorado cuando disabled
      act(() => {
        capturedMapProps?.onClick?.({
          detail: { latLng: { lat: -27.435, lng: -65.618 } },
        });
      });
      expect(onChange).not.toHaveBeenCalled();

      // Teclado ignorado
      const container = screen.getByTestId('map-container');
      expect(container.getAttribute('tabIndex')).toBe('-1');
      fireEvent.keyDown(container, { key: 'ArrowUp' });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('5. H03 — Sin style inline en GoogleMap', () => {
    it('no pasa propiedad style inline al componente GoogleMap', () => {
      render(<MapPicker value={AGUILARES_CENTER} />);

      expect(capturedMapProps).not.toBeNull();
      expect(capturedMapProps?.style).toBeUndefined();
    });
  });

  describe('6. H04 — Asociación accesible de label', () => {
    it('asocia el label al contenedor focusable mediante aria-labelledby', () => {
      render(<MapPicker label="Ubicación del local" value={AGUILARES_CENTER} />);

      const region = screen.getByRole('region', { name: 'Ubicación del local' });
      expect(region).toBeDefined();
      expect(region.getAttribute('data-testid')).toBe('map-container');
    });

    it('usa aria-label cuando label no está presente', () => {
      render(<MapPicker ariaLabel="Selector de entrega" value={AGUILARES_CENTER} />);

      const region = screen.getByRole('region', { name: 'Selector de entrega' });
      expect(region).toBeDefined();
      expect(region.getAttribute('data-testid')).toBe('map-container');
    });

    it('usa nombre accesible por defecto cuando no se pasa ni label ni ariaLabel', () => {
      render(<MapPicker value={AGUILARES_CENTER} />);

      const region = screen.getByRole('region', {
        name: 'Selector interactivo de ubicación en el mapa',
      });
      expect(region).toBeDefined();
    });
  });

  describe('7. P1 / T-323 DoD — Pan del mapa libre sin loop de cámara', () => {
    it('el evento onCameraChanged de GoogleMap NO debe ejecutar onChange ni alterar las coordenadas seleccionadas', () => {
      const onChange = vi.fn();

      render(<MapPicker value={AGUILARES_CENTER} onChange={onChange} />);

      expect(capturedMapProps).not.toBeNull();
      expect(capturedMapProps?.onCameraChanged).toBeTypeOf('function');

      act(() => {
        capturedMapProps?.onCameraChanged?.({
          detail: {
            center: {
              lat: -27.4356789,
              lng: -65.6189123,
            },
          },
        });
      });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('8. P1 / T-323 DoD — Selección directa por drag del pin y click/tap en mapa', () => {
    it('arrastrar el pin (onDragEnd) persiste coordenadas redondeadas llamando a onChange una sola vez y NO recentra la cámara', () => {
      const onChange = vi.fn();

      render(<MapPicker value={AGUILARES_CENTER} onChange={onChange} />);
      mockPanTo.mockClear();

      expect(getCapturedMarkerProps()).not.toBeNull();
      expect(getCapturedMarkerProps()?.draggable).toBe(true);

      act(() => {
        getCapturedMarkerProps()?.onDragEnd?.({
          latLng: {
            lat: () => -27.4367891,
            lng: () => -65.6198765,
          },
        });
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({
        lat: -27.436789,
        lng: -65.619877,
      });
      expect(getCapturedMarkerProps()?.position).toEqual({
        lat: -27.436789,
        lng: -65.619877,
      });
      expect(mockPanTo).toHaveBeenCalledTimes(0);
    });

    it('con mapId ausente (string vacío): NO renderiza AdvancedMarker, SÍ renderiza legacy Marker draggable, su onDragEnd persiste coordenadas y NO recentra', () => {
      mockPublicMapId = '';
      const onChange = vi.fn();

      render(<MapPicker value={AGUILARES_CENTER} onChange={onChange} />);
      mockPanTo.mockClear();

      // AdvancedMarker NO debe renderizarse sin mapId
      expect(screen.queryByTestId('mock-advanced-marker')).toBeNull();
      expect(screen.queryByTestId('map-marker-pin')).toBeNull();

      // Legacy Marker SÍ debe renderizarse
      expect(screen.getByTestId('mock-legacy-marker')).toBeDefined();
      expect(capturedLegacyMarkerProps).not.toBeNull();
      expect(capturedLegacyMarkerProps?.draggable).toBe(true);
      expect(capturedLegacyMarkerProps?.title).toBe('Ubicación seleccionada');

      act(() => {
        capturedLegacyMarkerProps?.onDragEnd?.({
          latLng: {
            lat: () => -27.4367891,
            lng: () => -65.6198765,
          },
        });
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({
        lat: -27.436789,
        lng: -65.619877,
      });
      expect(capturedLegacyMarkerProps?.position).toEqual({
        lat: -27.436789,
        lng: -65.619877,
      });
      expect(mockPanTo).toHaveBeenCalledTimes(0);
    });

    it('con mapId presente: renderiza AdvancedMarker draggable, su onDragEnd persiste coordenadas y NO recentra', () => {
      mockPublicMapId = 'test-map-id';
      const onChange = vi.fn();

      render(<MapPicker value={AGUILARES_CENTER} onChange={onChange} />);
      mockPanTo.mockClear();

      // Legacy Marker NO debe renderizarse si mapId existe
      expect(screen.queryByTestId('mock-legacy-marker')).toBeNull();

      // AdvancedMarker SÍ debe renderizarse con su pin personalizado
      expect(screen.getByTestId('mock-advanced-marker')).toBeDefined();
      expect(screen.getByTestId('map-marker-pin')).toBeDefined();
      expect(capturedAdvancedMarkerProps).not.toBeNull();
      expect(capturedAdvancedMarkerProps?.draggable).toBe(true);
      expect(capturedAdvancedMarkerProps?.title).toBe('Ubicación seleccionada');

      act(() => {
        capturedAdvancedMarkerProps?.onDragEnd?.({
          latLng: {
            lat: () => -27.4367891,
            lng: () => -65.6198765,
          },
        });
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({
        lat: -27.436789,
        lng: -65.619877,
      });
      expect(capturedAdvancedMarkerProps?.position).toEqual({
        lat: -27.436789,
        lng: -65.619877,
      });
      expect(mockPanTo).toHaveBeenCalledTimes(0);
    });

    it('con disabled=true: ninguna variante (con o sin mapId) permite drag ni persistencia', () => {
      // 1. Sin mapId (legacy Marker)
      mockPublicMapId = '';
      const onChangeWithoutMapId = vi.fn();
      const { unmount } = render(
        <MapPicker value={AGUILARES_CENTER} onChange={onChangeWithoutMapId} disabled />
      );

      expect(capturedLegacyMarkerProps?.draggable).toBe(false);
      act(() => {
        capturedLegacyMarkerProps?.onDragEnd?.({
          latLng: { lat: -27.435, lng: -65.618 },
        });
      });
      expect(onChangeWithoutMapId).not.toHaveBeenCalled();
      unmount();

      // 2. Con mapId (AdvancedMarker)
      mockPublicMapId = 'test-map-id';
      const onChangeWithMapId = vi.fn();
      render(<MapPicker value={AGUILARES_CENTER} onChange={onChangeWithMapId} disabled />);

      expect(capturedAdvancedMarkerProps?.draggable).toBe(false);
      act(() => {
        capturedAdvancedMarkerProps?.onDragEnd?.({
          latLng: { lat: -27.435, lng: -65.618 },
        });
      });
      expect(onChangeWithMapId).not.toHaveBeenCalled();
    });

    it('hacer click/tap en el mapa (onClick) reposiciona el pin, llama a onChange una sola vez y NO recentra la cámara tanto con mapId como sin mapId', () => {
      // 1. Con mapId
      mockPublicMapId = 'test-map-id';
      const onChangeWithMapId = vi.fn();
      const { unmount } = render(
        <MapPicker value={AGUILARES_CENTER} onChange={onChangeWithMapId} />
      );
      mockPanTo.mockClear();

      expect(capturedMapProps).not.toBeNull();
      act(() => {
        capturedMapProps?.onClick?.({
          detail: {
            latLng: { lat: -27.4381234, lng: -65.6145678 },
          },
        });
      });

      expect(onChangeWithMapId).toHaveBeenCalledTimes(1);
      expect(onChangeWithMapId).toHaveBeenCalledWith({
        lat: -27.438123,
        lng: -65.614568,
      });
      expect(capturedAdvancedMarkerProps?.position).toEqual({
        lat: -27.438123,
        lng: -65.614568,
      });
      expect(mockPanTo).toHaveBeenCalledTimes(0);
      unmount();

      // 2. Sin mapId
      mockPublicMapId = '';
      const onChangeWithoutMapId = vi.fn();
      render(<MapPicker value={AGUILARES_CENTER} onChange={onChangeWithoutMapId} />);
      mockPanTo.mockClear();

      act(() => {
        capturedMapProps?.onClick?.({
          detail: {
            latLng: { lat: -27.4381234, lng: -65.6145678 },
          },
        });
      });

      expect(onChangeWithoutMapId).toHaveBeenCalledTimes(1);
      expect(onChangeWithoutMapId).toHaveBeenCalledWith({
        lat: -27.438123,
        lng: -65.614568,
      });
      expect(capturedLegacyMarkerProps?.position).toEqual({
        lat: -27.438123,
        lng: -65.614568,
      });
      expect(mockPanTo).toHaveBeenCalledTimes(0);
    });

    it('consumidor controlado real: el eco de value tras drag del pin actualiza la posición del pin y NO recentra la cámara (mockPanTo = 0)', () => {
      mockPublicMapId = 'test-map-id';
      function ControlledMapPicker() {
        const [value, setValue] = React.useState<MapCoordinates>(AGUILARES_CENTER);
        return <MapPicker value={value} onChange={setValue} />;
      }

      render(<ControlledMapPicker />);
      mockPanTo.mockClear();

      act(() => {
        capturedAdvancedMarkerProps?.onDragEnd?.({
          latLng: {
            lat: () => -27.4367891,
            lng: () => -65.6198765,
          },
        });
      });

      expect(capturedAdvancedMarkerProps?.position).toEqual({
        lat: -27.436789,
        lng: -65.619877,
      });
      expect(mockPanTo).toHaveBeenCalledTimes(0);
    });

    it('consumidor controlado real: el eco de value tras click en el mapa actualiza la posición del pin y NO recentra la cámara (mockPanTo = 0)', () => {
      mockPublicMapId = 'test-map-id';
      function ControlledMapPicker() {
        const [value, setValue] = React.useState<MapCoordinates>(AGUILARES_CENTER);
        return <MapPicker value={value} onChange={setValue} />;
      }

      render(<ControlledMapPicker />);
      mockPanTo.mockClear();

      act(() => {
        capturedMapProps?.onClick?.({
          detail: {
            latLng: { lat: -27.4381234, lng: -65.6145678 },
          },
        });
      });

      expect(capturedAdvancedMarkerProps?.position).toEqual({
        lat: -27.438123,
        lng: -65.614568,
      });
      expect(mockPanTo).toHaveBeenCalledTimes(0);
    });

    it('consumidor controlado real: orden externa hacia el target anterior tras drag B → externo A recentra la cámara a A', () => {
      mockPublicMapId = 'test-map-id';
      let setExternalValue:
        | React.Dispatch<React.SetStateAction<MapCoordinates>>
        | null = null;
      function ControlledMapPicker() {
        const [value, setValue] = React.useState<MapCoordinates>(AGUILARES_CENTER);
        setExternalValue = setValue;
        return <MapPicker value={value} onChange={setValue} />;
      }

      render(<ControlledMapPicker />);
      const coordA = AGUILARES_CENTER;
      mockPanTo.mockClear();

      act(() => {
        capturedAdvancedMarkerProps?.onDragEnd?.({
          latLng: {
            lat: () => -27.4367891,
            lng: () => -65.6198765,
          },
        });
      });

      expect(capturedAdvancedMarkerProps?.position).toEqual({
        lat: -27.436789,
        lng: -65.619877,
      });
      expect(mockPanTo).toHaveBeenCalledTimes(0);

      act(() => {
        setExternalValue?.(coordA);
      });

      expect(capturedAdvancedMarkerProps?.position).toEqual(coordA);
      expect(mockPanTo).toHaveBeenCalledTimes(1);
      expect(mockPanTo).toHaveBeenCalledWith(coordA);
    });

    it('consumidor controlado real: orden externa hacia el target anterior tras click B → externo A recentra la cámara a A', () => {
      mockPublicMapId = 'test-map-id';
      let setExternalValue:
        | React.Dispatch<React.SetStateAction<MapCoordinates>>
        | null = null;
      function ControlledMapPicker() {
        const [value, setValue] = React.useState<MapCoordinates>(AGUILARES_CENTER);
        setExternalValue = setValue;
        return <MapPicker value={value} onChange={setValue} />;
      }

      render(<ControlledMapPicker />);
      const coordA = AGUILARES_CENTER;
      mockPanTo.mockClear();

      act(() => {
        capturedMapProps?.onClick?.({
          detail: {
            latLng: { lat: -27.4381234, lng: -65.6145678 },
          },
        });
      });

      expect(capturedAdvancedMarkerProps?.position).toEqual({
        lat: -27.438123,
        lng: -65.614568,
      });
      expect(mockPanTo).toHaveBeenCalledTimes(0);

      act(() => {
        setExternalValue?.(coordA);
      });

      expect(capturedAdvancedMarkerProps?.position).toEqual(coordA);
      expect(mockPanTo).toHaveBeenCalledTimes(1);
      expect(mockPanTo).toHaveBeenCalledWith(coordA);
    });

    it('mismo value numérico en objeto nuevo: no emite nueva orden de cámara en un rerender', () => {
      mockPublicMapId = 'test-map-id';
      const onChange = vi.fn();
      const coordA = { lat: -27.4333, lng: -65.6167 };
      const { rerender } = render(<MapPicker value={coordA} onChange={onChange} />);
      mockPanTo.mockClear();

      // Rerender con un nuevo objeto con las mismas coordenadas
      rerender(<MapPicker value={{ ...coordA }} onChange={onChange} />);

      expect(mockPanTo).toHaveBeenCalledTimes(0);
    });

    it('mismo defaultZoneCenter numérico tras selección manual no resetea la selección a A (pin sigue en B, mockPanTo=0)', () => {
      mockPublicMapId = 'test-map-id';
      const onChange = vi.fn();
      const coordA = { lat: -27.4333, lng: -65.6167 };

      const { rerender } = render(<MapPicker defaultZoneCenter={coordA} onChange={onChange} />);
      mockPanTo.mockClear();

      // Arrastre manual a B
      act(() => {
        capturedAdvancedMarkerProps?.onDragEnd?.({
          latLng: {
            lat: () => -27.4367891,
            lng: () => -65.6198765,
          },
        });
      });

      const coordB = { lat: -27.436789, lng: -65.619877 };
      expect(capturedAdvancedMarkerProps?.position).toEqual(coordB);
      expect(mockPanTo).toHaveBeenCalledTimes(0);

      // D: Rerender con un nuevo objeto pero mismas coordenadas para defaultZoneCenter
      rerender(<MapPicker defaultZoneCenter={{ ...coordA }} onChange={onChange} />);
      expect(capturedAdvancedMarkerProps?.position).toEqual(coordB);
      expect(mockPanTo).toHaveBeenCalledTimes(0);
    });

    it('defaultZoneCenter realmente distinto tras selección manual actualiza el pin a C y recentra la cámara a C', () => {
      mockPublicMapId = 'test-map-id';
      const onChange = vi.fn();
      const coordA = { lat: -27.4333, lng: -65.6167 };
      const coordC = { lat: -27.4411, lng: -65.6222 };

      const { rerender } = render(<MapPicker defaultZoneCenter={coordA} onChange={onChange} />);
      mockPanTo.mockClear();

      // Arrastre manual a B
      act(() => {
        capturedAdvancedMarkerProps?.onDragEnd?.({
          latLng: {
            lat: () => -27.4367891,
            lng: () => -65.6198765,
          },
        });
      });

      const coordB = { lat: -27.436789, lng: -65.619877 };
      expect(capturedAdvancedMarkerProps?.position).toEqual(coordB);
      expect(mockPanTo).toHaveBeenCalledTimes(0);

      // E: defaultZoneCenter cambia a coordenadas numéricamente distintas (C)
      rerender(<MapPicker defaultZoneCenter={coordC} onChange={onChange} />);
      expect(capturedAdvancedMarkerProps?.position).toEqual(coordC);
      expect(mockPanTo).toHaveBeenCalledTimes(1);
      expect(mockPanTo).toHaveBeenCalledWith(coordC);
    });
  });

  describe('9. P1 / T-323 DoD — Eliminación de D-pad, badge y crosshair fijo, preservando teclado accesible', () => {
    it('NO renderiza crosshair central fijo, D-pad flotante ni badge de coordenadas (con mapId)', () => {
      mockPublicMapId = 'test-map-id';
      render(<MapPicker value={AGUILARES_CENTER} />);

      expect(screen.queryByTestId('map-crosshair')).toBeNull();
      expect(screen.queryByTestId('map-fine-adjustment')).toBeNull();
      expect(screen.queryByTestId('map-coords-badge')).toBeNull();
      expect(screen.queryByTestId('nudge-north')).toBeNull();
      expect(screen.queryByTestId('nudge-south')).toBeNull();
      expect(screen.queryByTestId('nudge-east')).toBeNull();
      expect(screen.queryByTestId('nudge-west')).toBeNull();
      expect(screen.getByTestId('mock-advanced-marker')).toBeDefined();
    });

    it('NO renderiza crosshair central fijo, D-pad flotante ni badge de coordenadas (sin mapId)', () => {
      mockPublicMapId = '';
      render(<MapPicker value={AGUILARES_CENTER} />);

      expect(screen.queryByTestId('map-crosshair')).toBeNull();
      expect(screen.queryByTestId('map-fine-adjustment')).toBeNull();
      expect(screen.queryByTestId('map-coords-badge')).toBeNull();
      expect(screen.queryByTestId('nudge-north')).toBeNull();
      expect(screen.queryByTestId('nudge-south')).toBeNull();
      expect(screen.queryByTestId('nudge-east')).toBeNull();
      expect(screen.queryByTestId('nudge-west')).toBeNull();
      expect(screen.getByTestId('mock-legacy-marker')).toBeDefined();
    });

    it('responde a las 4 flechas del teclado en el contenedor del mapa para ajuste accesible y sincroniza la cámara', () => {
      const onChange = vi.fn();

      render(<MapPicker value={AGUILARES_CENTER} onChange={onChange} />);
      mockPanTo.mockClear();

      const container = screen.getByTestId('map-container');
      expect(container.getAttribute('tabIndex')).toBe('0');

      const expectedNorth = {
        lat: Number((AGUILARES_CENTER.lat + 0.0001).toFixed(6)),
        lng: AGUILARES_CENTER.lng,
      };
      fireEvent.keyDown(container, { key: 'ArrowUp' });
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining(expectedNorth));
      expect(getCapturedMarkerProps()?.position).toEqual(expectedNorth);
      expect(mockPanTo).toHaveBeenLastCalledWith(expectedNorth);

      const expectedSouth = {
        lat: Number((AGUILARES_CENTER.lat - 0.0001).toFixed(6)),
        lng: AGUILARES_CENTER.lng,
      };
      fireEvent.keyDown(container, { key: 'ArrowDown' });
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining(expectedSouth));
      expect(getCapturedMarkerProps()?.position).toEqual(expectedSouth);
      expect(mockPanTo).toHaveBeenLastCalledWith(expectedSouth);

      const expectedWest = {
        lat: AGUILARES_CENTER.lat,
        lng: Number((AGUILARES_CENTER.lng - 0.0001).toFixed(6)),
      };
      fireEvent.keyDown(container, { key: 'ArrowLeft' });
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining(expectedWest));
      expect(getCapturedMarkerProps()?.position).toEqual(expectedWest);
      expect(mockPanTo).toHaveBeenLastCalledWith(expectedWest);

      const expectedEast = {
        lat: AGUILARES_CENTER.lat,
        lng: Number((AGUILARES_CENTER.lng + 0.0001).toFixed(6)),
      };
      fireEvent.keyDown(container, { key: 'ArrowRight' });
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining(expectedEast));
      expect(getCapturedMarkerProps()?.position).toEqual(expectedEast);
      expect(mockPanTo).toHaveBeenLastCalledWith(expectedEast);

      // Tecla no direccional
      onChange.mockClear();
      fireEvent.keyDown(container, { key: 'Enter' });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('10. H09 — Composición sin controles duplicados', () => {
    it('NO renderiza un input de texto de dirección dentro de MapPicker', () => {
      render(<MapPicker value={AGUILARES_CENTER} />);
      expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('por defecto NO renderiza el botón Usar mi ubicación para evitar duplicación con el form anfitrión', () => {
      render(<MapPicker value={AGUILARES_CENTER} />);
      expect(screen.queryByRole('button', { name: /usar mi ubicación/i })).toBeNull();
    });

    it('renderiza el botón Usar mi ubicación solo cuando showLocationButton es true', () => {
      render(<MapPicker value={AGUILARES_CENTER} showLocationButton />);
      expect(screen.getByRole('button', { name: /usar mi ubicación/i })).toBeDefined();
    });
  });

  describe('11. Validación Zod de límites de Aguilares', () => {
    it('valida coordenadas céntricas dentro de AGUILARES_BOUNDS', () => {
      const res = aguilaresCoordinatesSchema.safeParse(AGUILARES_CENTER);
      expect(res.success).toBe(true);
      expect(isWithinAguilaresBounds(AGUILARES_CENTER.lat, AGUILARES_CENTER.lng)).toBe(true);
    });

    it('rechaza coordenadas fuera de Aguilares', () => {
      const res = aguilaresCoordinatesSchema.safeParse({ lat: -27.50, lng: -65.70 });
      expect(res.success).toBe(false);
      expect(isWithinAguilaresBounds(-27.50, -65.70)).toBe(false);
    });

    it('muestra role="alert" cuando value está fuera del bounding box', () => {
      render(<MapPicker value={{ lat: -27.50, lng: -65.70 }} />);

      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByRole('alert').textContent).toMatch(/ubicación fuera de aguilares/i);
    });
  });

  describe('12. MapSkeleton y aislamiento de bundles', () => {
    it('renderiza MapSkeleton con accesibilidad role="status"', () => {
      render(<MapSkeleton />);

      const skeleton = screen.getByTestId('map-skeleton');
      expect(skeleton).toBeDefined();
      expect(skeleton.getAttribute('role')).toBe('status');
      expect(skeleton.getAttribute('aria-label')).toBe('Cargando mapa...');
    });

    it('renderiza helperText opcional si se provee', () => {
      render(
        <MapPicker
          value={AGUILARES_CENTER}
          helperText="Mové el mapa para marcar la puerta exacta"
        />
      );
      expect(screen.getByText('Mové el mapa para marcar la puerta exacta')).toBeDefined();
    });

    it('map-skeleton.tsx no importa @vis.gl/react-google-maps ni SDKs externos', () => {
      const skeletonFile = path.resolve(__dirname, './map-skeleton.tsx');
      const content = fs.readFileSync(skeletonFile, 'utf8');

      expect(content).not.toMatch(/@vis\.gl\/react-google-maps/);
      expect(content).not.toMatch(/google/i);
    });

    it('D3/D15: el feed del repartidor no monta ni importa MapPicker', () => {
      const feedPage = path.resolve('src/app/(courier)/courier/feed/page.tsx');
      if (fs.existsSync(feedPage)) {
        const content = fs.readFileSync(feedPage, 'utf8');
        expect(content).not.toMatch(/MapPicker/);
        expect(content).not.toMatch(/@vis\.gl\/react-google-maps/);
      }
    });
  });
});
