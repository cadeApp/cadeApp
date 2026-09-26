// @vitest-environment jsdom
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AGUILARES_BOUNDS, isWithinAguilaresBounds } from '@/domain/schemas';
import { MapCoordinates, MapPicker, MapSkeleton } from './map';

describe('T-116 DoD: Componente de mapa src/ui/map.tsx', () => {
  const originalEnv = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const originalGeolocation = navigator.geolocation;
  const originalOnLine = navigator.onLine;

  const CENTER_AGUILARES: MapCoordinates = {
    lat: -27.4333,
    lng: -65.6167,
  };

  const OUT_OF_BOUNDS_LOCATION: MapCoordinates = {
    lat: -26.8241, // San Miguel de Tucumán
    lng: -65.2226,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    cleanup();
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'mock-google-maps-api-key';
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = originalEnv;
    if (originalGeolocation) {
      Object.defineProperty(navigator, 'geolocation', {
        value: originalGeolocation,
        writable: true,
        configurable: true,
      });
    }
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      writable: true,
      configurable: true,
    });
    cleanup();
  });

  describe('1. Fallback graceful: sin API key, offline o Google caído', () => {
    it('muestra el banner de degradación y fallback cuando no hay API key de Google', () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      render(
        <MapPicker
          value={CENTER_AGUILARES}
          defaultZoneCenter={CENTER_AGUILARES}
          addressText="San Martín 450"
        />
      );

      // Debe mostrar aviso claro de degradación
      const fallbackNotice = screen.getByText(/mapas no disponible|servicio de mapas no disponible/i);
      expect(fallbackNotice).toBeDefined();

      // El formulario de texto debe seguir operativo
      expect(screen.queryByRole('textbox', { name: /dirección|calle/i })).not.toBeNull();
    });

    it('muestra estado offline degradado cuando el navegador está sin conexión (T03)', () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      });

      render(
        <MapPicker
          value={CENTER_AGUILARES}
          defaultZoneCenter={CENTER_AGUILARES}
        />
      );

      // Debe mostrar aviso de modo sin conexión
      expect(screen.getByText(/sin conexión|modo sin conexión/i)).toBeDefined();
      // Debe ofrecer botón de reintento
      expect(screen.getByRole('button', { name: /reintentar/i })).toBeDefined();
    });

    it('permite operar el formulario de dirección manual aun con mapa caído', () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      const onAddressSelect = vi.fn();

      render(
        <MapPicker
          value={null}
          defaultZoneCenter={CENTER_AGUILARES}
          onAddressSelect={onAddressSelect}
        />
      );

      const input = screen.getByRole('textbox', { name: /dirección|calle/i });
      fireEvent.change(input, { target: { value: 'Alberdi 120, Barrio Sur' } });

      expect(input).toHaveProperty('value', 'Alberdi 120, Barrio Sur');
    });
  });

  describe('2. Selector interactivo de pin con crosshair central fijo', () => {
    it('renderiza el visor de mapa con el crosshair central fijo', () => {
      render(
        <MapPicker
          value={CENTER_AGUILARES}
          defaultZoneCenter={CENTER_AGUILARES}
        />
      );

      // El crosshair central fijo debe estar presente y accesible
      const crosshair = screen.getByTestId('map-crosshair');
      expect(crosshair).toBeDefined();
      expect(crosshair.getAttribute('aria-hidden')).toBe('true');
    });

    it('actualiza las coordenadas al desplazar el centro del mapa', async () => {
      const onChange = vi.fn();

      render(
        <MapPicker
          value={CENTER_AGUILARES}
          onChange={onChange}
          defaultZoneCenter={CENTER_AGUILARES}
        />
      );

      const mapContainer = screen.getByTestId('map-container');
      expect(mapContainer).toBeDefined();

      // Simular evento de desplazamiento / cambio de centro del mapa
      fireEvent.keyDown(mapContainer, { key: 'ArrowUp', code: 'ArrowUp' });

      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });
    });
  });

  describe('3. Botón "Usar mi ubicación"', () => {
    it('centra el mapa y actualiza coordenadas si el GPS responde dentro de Aguilares', async () => {
      const onChange = vi.fn();
      const mockCoords = {
        latitude: -27.435,
        longitude: -65.615,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      };

      const mockGeolocation = {
        getCurrentPosition: vi.fn((success: PositionCallback) => {
          success({
            coords: mockCoords,
            timestamp: Date.now(),
          } as GeolocationPosition);
        }),
        watchPosition: vi.fn(),
        clearWatch: vi.fn(),
      };

      Object.defineProperty(navigator, 'geolocation', {
        value: mockGeolocation,
        writable: true,
        configurable: true,
      });

      render(
        <MapPicker
          value={CENTER_AGUILARES}
          onChange={onChange}
        />
      );

      const myLocationButton = screen.getByRole('button', { name: /usar mi ubicación/i });
      fireEvent.click(myLocationButton);

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith({
          lat: -27.435,
          lng: -65.615,
        });
      });
    });

    it('muestra alerta inline si la ubicación obtenida está fuera de Aguilares', async () => {
      const onChange = vi.fn();
      const mockGeolocation = {
        getCurrentPosition: vi.fn((success: PositionCallback) => {
          success({
            coords: {
              latitude: OUT_OF_BOUNDS_LOCATION.lat,
              longitude: OUT_OF_BOUNDS_LOCATION.lng,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          } as GeolocationPosition);
        }),
        watchPosition: vi.fn(),
        clearWatch: vi.fn(),
      };

      Object.defineProperty(navigator, 'geolocation', {
        value: mockGeolocation,
        writable: true,
        configurable: true,
      });

      render(
        <MapPicker
          value={CENTER_AGUILARES}
          onChange={onChange}
        />
      );

      const myLocationButton = screen.getByRole('button', { name: /usar mi ubicación/i });
      fireEvent.click(myLocationButton);

      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert.textContent).toMatch(/fuera del radio de aguilares/i);
      });

      // No debe actualizar las coordenadas con un punto fuera de Aguilares
      expect(onChange).not.toHaveBeenCalledWith(OUT_OF_BOUNDS_LOCATION);
    });

    it('maneja el error de permiso denegado sin romper el componente', async () => {
      const mockGeolocation = {
        getCurrentPosition: vi.fn((_success: PositionCallback, error?: PositionErrorCallback) => {
          if (error) {
            error({
              code: 1, // PERMISSION_DENIED
              message: 'User denied Geolocation',
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            } as GeolocationPositionError);
          }
        }),
        watchPosition: vi.fn(),
        clearWatch: vi.fn(),
      };

      Object.defineProperty(navigator, 'geolocation', {
        value: mockGeolocation,
        writable: true,
        configurable: true,
      });

      render(<MapPicker value={CENTER_AGUILARES} />);

      const myLocationButton = screen.getByRole('button', { name: /usar mi ubicación/i });
      fireEvent.click(myLocationButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
      });
    });
  });

  describe('4. Botones de ajuste fino (D-pad para calles sin número)', () => {
    it('renderiza los 4 botones direccionales de ajuste fino con accesibilidad', () => {
      render(<MapPicker value={CENTER_AGUILARES} />);

      const btnNorte = screen.getByRole('button', { name: /ajustar al norte|mover al norte/i });
      const btnSur = screen.getByRole('button', { name: /ajustar al sur|mover al sur/i });
      const btnEste = screen.getByRole('button', { name: /ajustar al este|mover al este/i });
      const btnOeste = screen.getByRole('button', { name: /ajustar al oeste|mover al oeste/i });

      expect(btnNorte).toBeDefined();
      expect(btnSur).toBeDefined();
      expect(btnEste).toBeDefined();
      expect(btnOeste).toBeDefined();
    });

    it('ajusta la latitud hacia el norte en pasos finos de aprox 10m (0.0001 deg)', async () => {
      const onChange = vi.fn();

      render(
        <MapPicker
          value={CENTER_AGUILARES}
          onChange={onChange}
        />
      );

      const btnNorte = screen.getByRole('button', { name: /ajustar al norte|mover al norte/i });
      fireEvent.click(btnNorte);

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith({
          lat: expect.closeTo(CENTER_AGUILARES.lat + 0.0001, 5),
          lng: expect.closeTo(CENTER_AGUILARES.lng, 5),
        });
      });
    });

    it('ajusta la longitud hacia el este en pasos finos de aprox 10m (0.0001 deg)', async () => {
      const onChange = vi.fn();

      render(
        <MapPicker
          value={CENTER_AGUILARES}
          onChange={onChange}
        />
      );

      const btnEste = screen.getByRole('button', { name: /ajustar al este|mover al este/i });
      fireEvent.click(btnEste);

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith({
          lat: expect.closeTo(CENTER_AGUILARES.lat, 5),
          lng: expect.closeTo(CENTER_AGUILARES.lng + 0.0001, 5),
        });
      });
    });
  });

  describe('5. Validación Zod de límites de Aguilares', () => {
    it('valida que las coordenadas en el centro de Aguilares son válidas', () => {
      expect(isWithinAguilaresBounds(CENTER_AGUILARES.lat, CENTER_AGUILARES.lng)).toBe(true);
    });

    it('rechaza coordenadas en los extremos fuera de AGUILARES_BOUNDS', () => {
      expect(isWithinAguilaresBounds(AGUILARES_BOUNDS.minLat - 0.001, CENTER_AGUILARES.lng)).toBe(false);
      expect(isWithinAguilaresBounds(AGUILARES_BOUNDS.maxLat + 0.001, CENTER_AGUILARES.lng)).toBe(false);
      expect(isWithinAguilaresBounds(CENTER_AGUILARES.lat, AGUILARES_BOUNDS.minLng - 0.001)).toBe(false);
      expect(isWithinAguilaresBounds(CENTER_AGUILARES.lat, AGUILARES_BOUNDS.maxLng + 0.001)).toBe(false);
    });

    it('muestra mensaje inline si el pin se posiciona fuera de Aguilares', () => {
      render(
        <MapPicker
          value={OUT_OF_BOUNDS_LOCATION}
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert.textContent).toMatch(/el punto está fuera del radio de aguilares/i);
    });
  });

  describe('6. Carga diferida y MapSkeleton', () => {
    it('renderiza MapSkeleton con dimensiones y apariencia consistente', () => {
      render(<MapSkeleton className="h-64 w-full" />);

      const skeleton = screen.getByTestId('map-skeleton');
      expect(skeleton).toBeDefined();
    });
  });

  describe('7. Regla de Privacidad D3/D15: El feed del repartidor no monta el mapa', () => {
    it('el archivo courier-feed.tsx no importa ni monta src/ui/map', () => {
      const courierFeedPath = path.resolve(
        process.cwd(),
        'src/features/offers/components/courier-feed.tsx'
      );
      if (fs.existsSync(courierFeedPath)) {
        const content = fs.readFileSync(courierFeedPath, 'utf-8');
        expect(content).not.toContain('@/ui/map');
        expect(content).not.toContain('MapPicker');
      }
    });

    it('ninguna vista de solicitudes abiertas del courier monta el mapa', () => {
      const courierFeedPagePath = path.resolve(
        process.cwd(),
        'src/app/(courier)/courier/feed/page.tsx'
      );
      if (fs.existsSync(courierFeedPagePath)) {
        const content = fs.readFileSync(courierFeedPagePath, 'utf-8');
        expect(content).not.toContain('@/ui/map');
        expect(content).not.toContain('MapPicker');
      }
    });
  });
});
