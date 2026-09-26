'use client';

import * as React from 'react';
import { APIProvider, Map as GoogleMap } from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Crosshair,
  Info,
  MapPin,
  RotateCcw,
  WifiOff,
} from 'lucide-react';
import { AGUILARES_BOUNDS, isWithinAguilaresBounds } from '@/domain/schemas';
import { Button } from './button';
import { cn } from './cn';
import { Input } from './input';
import { Skeleton } from './skeleton';

export interface MapCoordinates {
  lat: number;
  lng: number;
}

export const AGUILARES_CENTER: MapCoordinates = {
  lat: -27.4333,
  lng: -65.6167,
};

export const FINE_ADJUST_DELTA = 0.0001; // ~10-11 metros en Aguilares

export interface MapPickerProps {
  value?: MapCoordinates | null;
  onChange?: (coords: MapCoordinates | null) => void;
  onAddressSelect?: (address: string) => void;
  addressText?: string;
  defaultZoneCenter?: MapCoordinates;
  disabled?: boolean;
  className?: string;
  label?: string;
  helperText?: string;
  readOnly?: boolean;
}

/**
 * Skeleton que replica la estructura y dimensiones del mapa cargado.
 * Se utiliza en `next/dynamic` como componente de carga obligatorio.
 */
export function MapSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-testid="map-skeleton"
      role="status"
      aria-label="Cargando mapa interactivo..."
      className={cn(
        'relative flex h-64 w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40 sm:h-72',
        className
      )}
    >
      <Skeleton className="h-full w-full" />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background/80 shadow-sm backdrop-blur-sm">
          <Crosshair className="h-6 w-6 animate-pulse text-muted-foreground" />
        </div>
        <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
          Cargando mapa interactivo...
        </span>
      </div>
    </div>
  );
}

/**
 * Componente interactivo de mapa para selección de pin en Aguilares (C01, C03).
 * Soporta Google Maps Platform (@vis.gl/react-google-maps), crosshair central fijo,
 * botones de ajuste fino (D-pad), geolocalización asistida y fallback graceful.
 */
export function MapPicker({
  value,
  onChange,
  onAddressSelect,
  addressText = '',
  defaultZoneCenter,
  disabled = false,
  className,
  label,
  helperText,
}: MapPickerProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  const [isOnline, setIsOnline] = React.useState<boolean>(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  });

  const [locating, setLocating] = React.useState(false);
  const [gpsError, setGpsError] = React.useState<string | null>(null);
  const [addressValue, setAddressValue] = React.useState(addressText);

  // Coordenadas actuales seleccionadas
  const activeCoords = React.useMemo<MapCoordinates>(() => {
    if (value != null) return value;
    if (defaultZoneCenter != null) return defaultZoneCenter;
    return AGUILARES_CENTER;
  }, [value, defaultZoneCenter]);

  // Sincronizar addressText si cambia externamente
  React.useEffect(() => {
    setAddressValue(addressText);
  }, [addressText]);

  // Listener para eventos de conectividad (modo sin conexión T03)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isMapAvailable = Boolean(apiKey) && isOnline;

  // Validación de límites de Aguilares
  const isOutOfBounds =
    value != null
      ? !isWithinAguilaresBounds(value.lat, value.lng)
      : !isWithinAguilaresBounds(activeCoords.lat, activeCoords.lng);

  // Manejo de entrada manual de dirección
  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAddressValue(val);
    onAddressSelect?.(val);
  };

  // Botón "Usar mi ubicación"
  const handleUseMyLocation = () => {
    if (disabled) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('La geolocalización no está disponible en este dispositivo.');
      return;
    }

    setLocating(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;

        if (!isWithinAguilaresBounds(latitude, longitude)) {
          setGpsError('El punto está fuera del radio de Aguilares');
          return;
        }

        const newPoint: MapCoordinates = {
          lat: Number(latitude.toFixed(6)),
          lng: Number(longitude.toFixed(6)),
        };

        onChange?.(newPoint);
      },
      (err) => {
        setLocating(false);
        if (err.code === 1) {
          setGpsError('Permiso de ubicación denegado. Podés marcar la ubicación con el mapa o ingresar tu dirección.');
        } else {
          setGpsError('No pudimos obtener tu ubicación actual. Probá de nuevo o ingresá la dirección.');
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Botones de ajuste fino (D-pad)
  const handleAdjust = (direction: 'north' | 'south' | 'east' | 'west') => {
    if (disabled) return;

    let nextLat = activeCoords.lat;
    let nextLng = activeCoords.lng;

    switch (direction) {
      case 'north':
        nextLat = Number((nextLat + FINE_ADJUST_DELTA).toFixed(6));
        break;
      case 'south':
        nextLat = Number((nextLat - FINE_ADJUST_DELTA).toFixed(6));
        break;
      case 'east':
        nextLng = Number((nextLng + FINE_ADJUST_DELTA).toFixed(6));
        break;
      case 'west':
        nextLng = Number((nextLng - FINE_ADJUST_DELTA).toFixed(6));
        break;
    }

    onChange?.({ lat: nextLat, lng: nextLng });
  };

  // Soporte de navegación por teclado en el visor del mapa
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleAdjust('north');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleAdjust('south');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleAdjust('east');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handleAdjust('west');
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      {label && (
        <label className="block text-sm font-semibold text-foreground">
          {label}
        </label>
      )}

      {/* Degradación elegante: Fallback sin conexión (T03) */}
      {!isOnline && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm text-foreground"
        >
          <div className="flex items-center gap-2.5">
            <WifiOff className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Modo sin conexión. Podés ingresar la dirección manualmente o reintentar cuando vuelva internet.</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsOnline(navigator.onLine)}
            className="shrink-0 font-medium"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reintentar
          </Button>
        </div>
      )}

      {/* Degradación elegante: Fallback sin API key o con servicio no disponible */}
      {!apiKey && isOnline && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-border bg-muted/50 p-3.5 text-sm text-muted-foreground"
        >
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary-dark" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">
              Servicio de mapas no disponible temporalmente.
            </p>
            <p>
              Podés ingresar la dirección manualmente y seleccionaremos el centroide de tu barrio.
            </p>
          </div>
        </div>
      )}

      {/* Contenedor interactivo del mapa */}
      <div
        data-testid="map-container"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        aria-label="Selector de ubicación en mapa de Aguilares. Usá las flechas del teclado o los botones de ajuste fino para mover el punto."
        className={cn(
          'relative flex h-64 w-full flex-col overflow-hidden rounded-xl border border-border bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-72',
          !isMapAvailable && 'bg-muted/60'
        )}
      >
        {isMapAvailable ? (
          <APIProvider apiKey={apiKey}>
            <GoogleMap
              center={activeCoords}
              defaultCenter={activeCoords}
              defaultZoom={16}
              gestureHandling="greedy"
              disableDefaultUI
              onCameraChanged={(ev) => {
                if (ev.detail.center) {
                  const newPoint: MapCoordinates = {
                    lat: Number(ev.detail.center.lat.toFixed(6)),
                    lng: Number(ev.detail.center.lng.toFixed(6)),
                  };
                  onChange?.(newPoint);
                }
              }}
              className="h-full w-full"
            />
          </APIProvider>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
            <MapPin className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm font-medium">Mapa interactivo no disponible en este momento</p>
            <p className="text-xs">Ubicación asignada al centro de Aguilares</p>
          </div>
        )}

        {/* Crosshair central fijo */}
        <div
          data-testid="map-crosshair"
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center"
        >
          <div className="relative flex items-center justify-center">
            {/* Anillo exterior de referencia */}
            <div className="h-8 w-8 rounded-full border-2 border-primary-dark/80 bg-primary/20 shadow-sm" />
            {/* Punto central exacto */}
            <div className="absolute h-2 w-2 rounded-full bg-primary-dark shadow" />
          </div>
          {/* Pequeña sombra de apoyo */}
          <div className="mt-0.5 h-1 w-3 rounded-full bg-black/20 blur-sm" />
        </div>

        {/* Coordenadas actuales / Badge informativo */}
        <div className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-md bg-background/90 px-2 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm">
          {activeCoords.lat.toFixed(4)}, {activeCoords.lng.toFixed(4)}
        </div>
      </div>

      {/* Alerta inline si está fuera de Aguilares */}
      {isOutOfBounds && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>El punto está fuera del radio de Aguilares</span>
        </div>
      )}

      {/* Alerta inline de error de GPS */}
      {gpsError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Barra de herramientas: Geolocalización y Ajuste Fino */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <Button
          type="button"
          variant="outline"
          size="default"
          onClick={handleUseMyLocation}
          disabled={locating || disabled}
          className="flex-1 sm:flex-initial"
        >
          <Crosshair className="h-4 w-4 text-primary-dark" />
          <span>{locating ? 'Obteniendo ubicación...' : 'Usar mi ubicación'}</span>
        </Button>

        {/* Controles de ajuste fino (D-pad) */}
        <div
          role="group"
          aria-label="Ajuste fino de posición"
          className="flex items-center gap-1.5"
        >
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Ajustar al norte"
            title="Ajustar al norte (~10 m)"
            disabled={disabled}
            onClick={() => handleAdjust('north')}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Ajustar al sur"
            title="Ajustar al sur (~10 m)"
            disabled={disabled}
            onClick={() => handleAdjust('south')}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Ajustar al oeste"
            title="Ajustar al oeste (~10 m)"
            disabled={disabled}
            onClick={() => handleAdjust('west')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Ajustar al este"
            title="Ajustar al este (~10 m)"
            disabled={disabled}
            onClick={() => handleAdjust('east')}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Entrada manual de dirección (operativa con o sin mapa) */}
      <div className="space-y-1.5 pt-1">
        <label
          htmlFor="map-manual-address-input"
          className="block text-sm font-medium text-foreground"
        >
          Dirección o punto de referencia
        </label>
        <div className="relative">
          <Input
            id="map-manual-address-input"
            aria-label="Dirección o punto de referencia"
            value={addressValue}
            onChange={handleAddressChange}
            disabled={disabled}
            placeholder="Ej: San Martín 450, frente a la plaza"
            className="pl-10"
          />
          <MapPin className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
        </div>
        {helperText && (
          <p className="text-xs text-muted-foreground">{helperText}</p>
        )}
      </div>
    </div>
  );
}
