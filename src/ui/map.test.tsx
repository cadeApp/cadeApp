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

// Configuración de mocks
let mockLoadingStatus = 'LOADED';
let capturedMapProps: {
  onCameraChanged?: (ev: { detail: { center: { lat: number; lng: number } } }) => void;
  defaultCenter?: MapCoordinates;
  disabled?: boolean;
} | null = null;
let mockOnError: (() => void) | null = null;

vi.mock('@/lib/env.public', () => ({
  publicEnv: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: 'test-google-maps-api-key',
    NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: 'test-map-id',
  },
  getPublicEnv: () => ({
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: 'test-google-maps-api-key',
    NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: 'test-map-id',
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
  Map: (props: {
    onCameraChanged?: (ev: { detail: { center: { lat: number; lng: number } } }) => void;
    defaultCenter?: MapCoordinates;
    disabled?: boolean;
  }) => {
    capturedMapProps = props;
    return <div data-testid="mock-google-map" />;
  },
}));

describe('CC-011 · Contrato compartido de mapa src/ui/map.tsx', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    mockLoadingStatus = 'LOADED';
    capturedMapProps = null;
    mockOnError = null;
  });

  beforeEach(() => {
    mockLoadingStatus = 'LOADED';
    capturedMapProps = null;
    mockOnError = null;

    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  describe('1. H02 — Fallback graceful ante Google realmente caído', () => {
    it('muestra aviso visible de fallback cuando APILoadingStatus es FAILED con key válida y online', async () => {
      mockLoadingStatus = 'FAILED';

      render(<MapPicker value={AGUILARES_CENTER} />);

      await waitFor(() => {
        expect(screen.getByTestId('map-load-error-banner')).toBeDefined();
      });

      expect(screen.getByText(/no pudimos conectar con google maps/i)).toBeDefined();
      expect(screen.getByTestId('map-fallback')).toBeDefined();
      // El mapa nativo no se renderiza
      expect(screen.queryByTestId('mock-google-map')).toBeNull();
    });

    it('muestra aviso de fallback cuando APIProvider invoca onError directamente', async () => {
      render(<MapPicker value={AGUILARES_CENTER} />);

      expect(screen.getByTestId('mock-google-map')).toBeDefined();
      expect(mockOnError).toBeTypeOf('function');

      // Disparar error de carga de API
      act(() => {
        mockOnError?.();
      });

      await waitFor(() => {
        expect(screen.getByTestId('map-load-error-banner')).toBeDefined();
      });
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
    });

    it('escucha eventos de online y offline dinámicos en window', () => {
      render(<MapPicker value={AGUILARES_CENTER} />);

      fireEvent(window, new Event('offline'));
      expect(screen.getByTestId('map-offline-banner')).toBeDefined();

      fireEvent(window, new Event('online'));
      expect(screen.queryByTestId('map-offline-banner')).toBeNull();
    });
  });

  describe('2. H06 — Callback real de onCameraChanged', () => {
    it('captura onCameraChanged de GoogleMap y entrega coordenadas redondeadas a onChange', async () => {
      const onChange = vi.fn();

      render(<MapPicker value={AGUILARES_CENTER} onChange={onChange} />);

      expect(capturedMapProps).not.toBeNull();
      expect(capturedMapProps?.onCameraChanged).toBeTypeOf('function');

      // Simular evento real de arrastre de cámara con detail.center
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

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({
        lat: -27.435679,
        lng: -65.618912,
      });

      // El badge visual refleja las nuevas coordenadas
      expect(screen.getByTestId('map-coords-badge').textContent).toContain('-27.4357, -65.6189');
    });

    it('ignora onCameraChanged cuando el componente está deshabilitado', () => {
      const onChange = vi.fn();

      render(<MapPicker value={AGUILARES_CENTER} onChange={onChange} disabled />);

      act(() => {
        capturedMapProps?.onCameraChanged?.({
          detail: {
            center: {
              lat: -27.435,
              lng: -65.618,
            },
          },
        });
      });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('3. H09 — Composición sin controles duplicados', () => {
    it('NO renderiza un input de texto de dirección dentro de MapPicker', () => {
      render(<MapPicker value={AGUILARES_CENTER} />);

      // No debe haber ningún input de texto para evitar duplicar C01/C03
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

    it('permite usar geolocalización cuando showLocationButton es true', async () => {
      const onChange = vi.fn();
      const mockCoords = { latitude: -27.4345, longitude: -65.6175 };

      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: vi.fn((success) =>
            success({
              coords: mockCoords,
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
          showLocationButton
        />
      );

      const btn = screen.getByRole('button', { name: /usar mi ubicación/i });
      fireEvent.click(btn);

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith({
          lat: -27.4345,
          lng: -65.6175,
        });
      });
    });

    it('muestra alerta si la geolocalización devuelve una ubicación fuera de Aguilares', async () => {
      const onChange = vi.fn();
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
          showLocationButton
        />
      );

      const btn = screen.getByRole('button', { name: /usar mi ubicación/i });
      fireEvent.click(btn);

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toMatch(/fuera de aguilares/i);
      });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('4. Selector de pin, crosshair y D-pad de ajuste fino', () => {
    it('renderiza el crosshair central fijo cuando el mapa está disponible', () => {
      render(<MapPicker value={AGUILARES_CENTER} />);

      expect(screen.getByTestId('map-crosshair')).toBeDefined();
    });

    it('renderiza los 4 controles direccionales del D-pad', () => {
      render(<MapPicker value={AGUILARES_CENTER} />);

      expect(screen.getByTestId('nudge-north')).toBeDefined();
      expect(screen.getByTestId('nudge-south')).toBeDefined();
      expect(screen.getByTestId('nudge-east')).toBeDefined();
      expect(screen.getByTestId('nudge-west')).toBeDefined();
    });

    it('ajusta la latitud hacia el norte en ~10 m (0.0001 deg)', async () => {
      const onChange = vi.fn();

      render(<MapPicker value={AGUILARES_CENTER} onChange={onChange} />);

      const btnNorte = screen.getByTestId('nudge-north');
      fireEvent.click(btnNorte);

      expect(onChange).toHaveBeenCalledWith({
        lat: Number((AGUILARES_CENTER.lat + 0.0001).toFixed(6)),
        lng: AGUILARES_CENTER.lng,
      });
    });

    it('ajusta la latitud hacia el sur en ~10 m', () => {
      const onChange = vi.fn();

      render(<MapPicker value={AGUILARES_CENTER} onChange={onChange} />);

      const btnSur = screen.getByTestId('nudge-south');
      fireEvent.click(btnSur);

      expect(onChange).toHaveBeenCalledWith({
        lat: Number((AGUILARES_CENTER.lat - 0.0001).toFixed(6)),
        lng: AGUILARES_CENTER.lng,
      });
    });

    it('ajusta la longitud hacia el este y oeste en ~10 m', () => {
      const onChange = vi.fn();

      render(<MapPicker value={AGUILARES_CENTER} onChange={onChange} />);

      fireEvent.click(screen.getByTestId('nudge-east'));
      expect(onChange).toHaveBeenLastCalledWith({
        lat: AGUILARES_CENTER.lat,
        lng: Number((AGUILARES_CENTER.lng + 0.0001).toFixed(6)),
      });

      fireEvent.click(screen.getByTestId('nudge-west'));
      expect(onChange).toHaveBeenLastCalledWith({
        lat: AGUILARES_CENTER.lat,
        lng: Number((AGUILARES_CENTER.lng - 0.0001).toFixed(6)),
      });
    });

    it('responde a las flechas del teclado en el contenedor del mapa', () => {
      const onChange = vi.fn();

      render(<MapPicker value={AGUILARES_CENTER} onChange={onChange} />);

      const container = screen.getByTestId('map-container');

      fireEvent.keyDown(container, { key: 'ArrowUp' });
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          lat: Number((AGUILARES_CENTER.lat + 0.0001).toFixed(6)),
        })
      );

      fireEvent.keyDown(container, { key: 'ArrowLeft' });
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          lng: Number((AGUILARES_CENTER.lng - 0.0001).toFixed(6)),
        })
      );
    });
  });

  describe('5. Validación Zod de límites de Aguilares', () => {
    it('valida coordenadas céntricas válidas', () => {
      const res = aguilaresCoordinatesSchema.safeParse(AGUILARES_CENTER);
      expect(res.success).toBe(true);
    });

    it('rechaza coordenadas fuera de Aguilares', () => {
      const res = aguilaresCoordinatesSchema.safeParse({ lat: -27.50, lng: -65.70 });
      expect(res.success).toBe(false);
    });

    it('muestra role="alert" cuando value está fuera del bounding box', () => {
      render(<MapPicker value={{ lat: -27.50, lng: -65.70 }} />);

      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByRole('alert').textContent).toMatch(/ubicación fuera de aguilares/i);
    });
  });

  describe('6. H03 — MapSkeleton desacoplado', () => {
    it('renderiza MapSkeleton con accesibilidad role="status"', () => {
      render(<MapSkeleton />);

      const skeleton = screen.getByTestId('map-skeleton');
      expect(skeleton).toBeDefined();
      expect(skeleton.getAttribute('role')).toBe('status');
      expect(skeleton.getAttribute('aria-label')).toBe('Cargando mapa...');
    });

    it('map-skeleton.tsx no importa @vis.gl/react-google-maps', () => {
      const skeletonFile = path.resolve(__dirname, './map-skeleton.tsx');
      const content = fs.readFileSync(skeletonFile, 'utf8');

      expect(content).not.toMatch(/@vis\.gl\/react-google-maps/);
      expect(content).not.toMatch(/google/i);
    });
  });

  describe('7. Invariante D3/D15: Privacidad y aislamiento de bundles', () => {
    it('el feed del repartidor no monta ni importa MapPicker', () => {
      const feedPage = path.resolve('src/app/(courier)/courier/feed/page.tsx');
      if (fs.existsSync(feedPage)) {
        const content = fs.readFileSync(feedPage, 'utf8');
        expect(content).not.toMatch(/MapPicker/);
        expect(content).not.toMatch(/@vis\.gl\/react-google-maps/);
      }
    });
  });
});
