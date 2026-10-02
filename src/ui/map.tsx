'use client';

import * as React from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  useApiLoadingStatus,
  APILoadingStatus,
  AdvancedMarker,
  Marker,
  useMap,
  type MapCameraChangedEvent,
  type MapMouseEvent,
} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  Crosshair,
  Info,
  Loader2,
  MapPin,
  WifiOff,
} from 'lucide-react';
import { z } from 'zod';
import { publicEnv } from '@/lib/env.public';
import { cn } from '@/ui/cn';
import { MapSkeleton, type MapSkeletonProps } from '@/ui/map-skeleton';

export { MapSkeleton, type MapSkeletonProps };

export interface MapCoordinates {
  lat: number;
  lng: number;
}

export const AGUILARES_CENTER: MapCoordinates = {
  lat: -27.4333,
  lng: -65.6167,
};

export const AGUILARES_BOUNDS = {
  minLat: -27.4550,
  maxLat: -27.4100,
  minLng: -65.6400,
  maxLng: -65.5950,
} as const;

export const aguilaresCoordinatesSchema = z.object({
  lat: z
    .number()
    .min(AGUILARES_BOUNDS.minLat, 'La ubicación está fuera del radio urbano de Aguilares')
    .max(AGUILARES_BOUNDS.maxLat, 'La ubicación está fuera del radio urbano de Aguilares'),
  lng: z
    .number()
    .min(AGUILARES_BOUNDS.minLng, 'La ubicación está fuera del radio urbano de Aguilares')
    .max(AGUILARES_BOUNDS.maxLng, 'La ubicación está fuera del radio urbano de Aguilares'),
});

export function isWithinAguilaresBounds(lat: number, lng: number): boolean {
  return (
    lat >= AGUILARES_BOUNDS.minLat &&
    lat <= AGUILARES_BOUNDS.maxLat &&
    lng >= AGUILARES_BOUNDS.minLng &&
    lng <= AGUILARES_BOUNDS.maxLng
  );
}

export interface MapPickerProps {
  value?: MapCoordinates | null;
  onChange?: (coords: MapCoordinates) => void;
  defaultZoneCenter?: MapCoordinates | null;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  label?: string;
  helperText?: string;
  showLocationButton?: boolean;
  onLocationFound?: (coords: MapCoordinates) => void;
  onLocationError?: (error: string) => void;
}

function MapStatusWatcher({ onFailed }: { onFailed: () => void }) {
  const status = useApiLoadingStatus();
  React.useEffect(() => {
    if (status === APILoadingStatus.FAILED) {
      onFailed();
    }
  }, [status, onFailed]);
  return null;
}

function MapCameraSynchronizer({ targetCoords }: { targetCoords: MapCoordinates }) {
  const map = useMap();
  const prevTargetRef = React.useRef<MapCoordinates>(targetCoords);

  React.useEffect(() => {
    if (!map) return;
    if (
      prevTargetRef.current.lat !== targetCoords.lat ||
      prevTargetRef.current.lng !== targetCoords.lng
    ) {
      prevTargetRef.current = targetCoords;
      map.panTo(targetCoords);
    }
  }, [map, targetCoords]);

  return null;
}

function extractLatLng(
  ev: {
    latLng?: { lat: number | (() => number); lng: number | (() => number) } | null;
    detail?: { latLng?: { lat: number | (() => number); lng: number | (() => number) } | null };
  }
): MapCoordinates | null {
  const latLng = ev.detail?.latLng ?? ev.latLng;
  if (!latLng) return null;
  const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
  const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return null;
  }
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
}

type AuthFailureListener = () => void;

const authFailureListeners = new Set<AuthFailureListener>();
let previousGlobalAuthFailure: (() => void) | undefined = undefined;
let installedBridgeHandler: (() => void) | null = null;

function globalAuthFailureBridge() {
  for (const listener of Array.from(authFailureListeners)) {
    try {
      listener();
    } catch {
      // Ignorar errores individuales para no bloquear otros listeners
    }
  }

  if (typeof previousGlobalAuthFailure === 'function') {
    try {
      previousGlobalAuthFailure();
    } catch {
      // Ignorar fallos de handlers externos
    }
  }
}

function registerAuthFailureListener(listener: AuthFailureListener): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  authFailureListeners.add(listener);

  if (authFailureListeners.size === 1) {
    const win = window as unknown as { gm_authFailure?: () => void };
    previousGlobalAuthFailure = win.gm_authFailure;
    installedBridgeHandler = globalAuthFailureBridge;
    win.gm_authFailure = globalAuthFailureBridge;
  }

  return () => {
    authFailureListeners.delete(listener);

    if (authFailureListeners.size === 0) {
      const win = window as unknown as { gm_authFailure?: () => void };
      if (win.gm_authFailure === installedBridgeHandler) {
        if (previousGlobalAuthFailure !== undefined) {
          win.gm_authFailure = previousGlobalAuthFailure;
        } else {
          delete win.gm_authFailure;
        }
      }
      previousGlobalAuthFailure = undefined;
      installedBridgeHandler = null;
    }
  };
}

export function resetAuthFailureBridgeForTesting(): void {
  authFailureListeners.clear();
  previousGlobalAuthFailure = undefined;
  installedBridgeHandler = null;
}

export function MapPicker({
  value,
  onChange,
  defaultZoneCenter,
  disabled = false,
  className,
  ariaLabel = 'Selector interactivo de ubicación en el mapa',
  label,
  helperText,
  showLocationButton = false,
  onLocationFound,
  onLocationError,
}: MapPickerProps) {
  const apiKey = publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const mapId = publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined;

  const [isOnline, setIsOnline] = React.useState<boolean>(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  });

  const [apiLoadFailed, setApiLoadFailed] = React.useState(false);
  const [locating, setLocating] = React.useState(false);
  const [geoError, setGeoError] = React.useState<string | null>(null);

  React.useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  React.useEffect(() => {
    return registerAuthFailureListener(() => {
      setApiLoadFailed(true);
    });
  }, []);

  const fallbackCenter = React.useMemo<MapCoordinates>(() => {
    if (value != null) return value;
    if (defaultZoneCenter != null) return defaultZoneCenter;
    return AGUILARES_CENTER;
  }, [value, defaultZoneCenter]);

  const [activeCoords, setActiveCoords] = React.useState<MapCoordinates>(fallbackCenter);

  React.useEffect(() => {
    if (value != null) {
      setActiveCoords(value);
    } else if (defaultZoneCenter != null) {
      setActiveCoords(defaultZoneCenter);
    }
  }, [value, defaultZoneCenter]);

  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const isMapAvailable = Boolean(apiKey) && isOnline && !apiLoadFailed;

  const isOutside =
    value != null
      ? !isWithinAguilaresBounds(value.lat, value.lng)
      : !isWithinAguilaresBounds(activeCoords.lat, activeCoords.lng);

  const handleCameraChange = React.useCallback(
    (_ev: MapCameraChangedEvent) => {
      // Invariant P1 / T-323: onCameraChanged MUST NOT call onChangeRef.current
      // to prevent the camera feedback loop during pan/zoom.
    },
    []
  );

  const handleMarkerDragEnd = React.useCallback(
    (
      ev: Parameters<
        NonNullable<React.ComponentProps<typeof Marker>['onDragEnd']>
      >[0]
    ) => {
      if (disabled) return;
      const coords = extractLatLng(ev);
      if (!coords) return;
      setActiveCoords(coords);
      onChangeRef.current?.(coords);
    },
    [disabled]
  );

  const handleMapClick = React.useCallback(
    (ev: MapMouseEvent) => {
      if (disabled) return;
      const coords = extractLatLng(ev);
      if (!coords) return;
      setActiveCoords(coords);
      onChangeRef.current?.(coords);
    },
    [disabled]
  );

  const handleNudge = React.useCallback(
    (dLat: number, dLng: number) => {
      if (disabled) return;
      const current = value ?? activeCoords;
      const next: MapCoordinates = {
        lat: Number((current.lat + dLat).toFixed(6)),
        lng: Number((current.lng + dLng).toFixed(6)),
      };
      setActiveCoords(next);
      onChangeRef.current?.(next);
    },
    [disabled, value, activeCoords]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      const STEP = 0.0001;
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          handleNudge(STEP, 0);
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleNudge(-STEP, 0);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleNudge(0, -STEP);
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNudge(0, STEP);
          break;
        default:
          break;
      }
    },
    [disabled, handleNudge]
  );

  const handleUseMyLocation = React.useCallback(() => {
    if (disabled || locating) return;
    setGeoError(null);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const err = 'La geolocalización no está disponible en este dispositivo.';
      setGeoError(err);
      onLocationError?.(err);
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        const coords: MapCoordinates = {
          lat: Number(latitude.toFixed(6)),
          lng: Number(longitude.toFixed(6)),
        };

        if (!isWithinAguilaresBounds(latitude, longitude)) {
          const err =
            'Tu ubicación actual está fuera de Aguilares. Por favor marcá el punto dentro de la ciudad.';
          setGeoError(err);
          onLocationError?.(err);
          return;
        }

        setActiveCoords(coords);
        onChangeRef.current?.(coords);
        onLocationFound?.(coords);
      },
      (err) => {
        setLocating(false);
        let msg = 'No pudimos obtener tu ubicación actual. Podés continuar con la dirección escrita.';
        if (err.code === 1) {
          msg = 'Permiso de ubicación denegado. Podés continuar con la dirección escrita.';
        }
        setGeoError(msg);
        onLocationError?.(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }, [disabled, locating, onLocationError, onLocationFound]);

  const labelId = React.useId();

  return (
    <div className={cn('w-full space-y-3', className)} data-testid="map-picker">
      {label && (
        <p id={labelId} className="text-sm font-medium text-foreground">
          {label}
        </p>
      )}
      {helperText && <p className="text-sm text-muted-foreground">{helperText}</p>}

      {!isOnline && (
        <div
          role="status"
          data-testid="map-offline-banner"
          className="flex items-center gap-2 rounded-lg border border-border bg-muted/60 p-3 text-sm text-muted-foreground"
        >
          <WifiOff className="h-5 w-5 shrink-0 text-muted-foreground" />
          <span>Modo sin conexión. Podés continuar ingresando la dirección manualmente.</span>
        </div>
      )}

      {!apiKey && isOnline && (
        <div
          role="status"
          data-testid="map-no-key-banner"
          className="flex items-center gap-2 rounded-lg border border-border bg-muted/60 p-3 text-sm text-muted-foreground"
        >
          <Info className="h-5 w-5 shrink-0 text-primary-dark" />
          <span>
            El mapa interactivo no está disponible. Podés ingresar la dirección y referencia manualmente.
          </span>
        </div>
      )}

      {apiLoadFailed && isOnline && Boolean(apiKey) && (
        <div
          role="status"
          data-testid="map-load-error-banner"
          className="flex items-center gap-2 rounded-lg border border-border bg-muted/60 p-3 text-sm text-muted-foreground"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <span>
            No pudimos conectar con Google Maps. Podés ingresar la dirección y referencia manualmente.
          </span>
        </div>
      )}

      {showLocationButton && (
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={disabled || locating}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {locating ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary-dark" />
          ) : (
            <Crosshair className="h-5 w-5 text-primary-dark" />
          )}
          <span>{locating ? 'Obteniendo ubicación...' : 'Usar mi ubicación actual'}</span>
        </button>
      )}

      {geoError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{geoError}</span>
        </div>
      )}

      {/* Contenedor del mapa */}
      <div
        role="region"
        data-testid="map-container"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : ariaLabel}
        className={cn(
          'relative h-64 sm:h-72 w-full overflow-hidden rounded-xl border border-border bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          !isMapAvailable && 'bg-muted/60'
        )}
      >
        {isMapAvailable ? (
          <APIProvider
            apiKey={apiKey}
            onError={() => {
              setApiLoadFailed(true);
            }}
          >
            <MapStatusWatcher onFailed={() => setApiLoadFailed(true)} />
            <GoogleMap
              defaultCenter={fallbackCenter}
              defaultZoom={15}
              gestureHandling={disabled ? 'none' : 'greedy'}
              disableDefaultUI
              mapId={mapId}
              onClick={handleMapClick}
              onCameraChanged={handleCameraChange}
            >
              <MapCameraSynchronizer targetCoords={activeCoords} />
              {mapId ? (
                <AdvancedMarker
                  position={activeCoords}
                  draggable={!disabled}
                  onDragEnd={handleMarkerDragEnd}
                  title="Ubicación seleccionada"
                >
                  <div
                    data-testid="map-marker-pin"
                    aria-label="Pin de ubicación seleccionada"
                    className="relative flex items-center justify-center"
                  >
                    <MapPin className="-translate-y-4 h-9 w-9 text-primary-dark drop-shadow-md" />
                    <div className="absolute h-2 w-2 rounded-full bg-primary-dark ring-2 ring-background" />
                  </div>
                </AdvancedMarker>
              ) : (
                <Marker
                  position={activeCoords}
                  draggable={!disabled}
                  onDragEnd={handleMarkerDragEnd}
                  title="Ubicación seleccionada"
                />
              )}
            </GoogleMap>
          </APIProvider>
        ) : (
          <div
            data-testid="map-fallback"
            className="flex h-full w-full flex-col items-center justify-center p-4 text-center text-muted-foreground"
          >
            <MapPin className="mb-2 h-10 w-10 text-muted-foreground/60" />
            <p className="text-sm font-medium text-foreground">
              {!isOnline
                ? 'Mapa no disponible sin conexión'
                : apiLoadFailed
                  ? 'Error al conectar con Google Maps'
                  : 'Mapa no configurado'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              La dirección escrita se utilizará para el retiro y la entrega.
            </p>
          </div>
        )}
      </div>

      {/* Advertencia si el pin queda fuera de Aguilares */}
      {isOutside && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>
            Ubicación fuera de Aguilares. Por favor, marcá el punto dentro del radio urbano de la ciudad.
          </span>
        </div>
      )}
    </div>
  );
}
