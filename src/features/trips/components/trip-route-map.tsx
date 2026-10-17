'use client';

import * as React from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  Marker,
  Polyline,
  useApiLoadingStatus,
  useMap,
  APILoadingStatus,
} from '@vis.gl/react-google-maps';
import { AlertTriangle, ExternalLink, Map as MapIcon, MapPin, Store, WifiOff } from 'lucide-react';
import { publicEnv } from '@/lib/env.public';
import { cn } from '@/ui/cn';
import {
  buildTripRoutePlan,
  MAX_NAVIGATION_WAYPOINTS,
  type NavigationLeg,
  type RouteCoordinate,
  type RouteStop,
} from '../route-points';

/** Margen en px alrededor de los pines al encuadrar el recorrido. */
const ROUTE_BOUNDS_PADDING_PX = 32;
/** Extensión mínima en grados del encuadre: evita el zoom máximo cuando los puntos coinciden (≈ 200 m). */
const MIN_ROUTE_BOUNDS_SPAN_DEG = 0.002;

interface RouteBounds {
  readonly north: number;
  readonly south: number;
  readonly east: number;
  readonly west: number;
}

/** Caja que contiene todos los puntos, con una extensión mínima para puntos coincidentes o muy cercanos. */
function computeRouteBounds(points: readonly RouteCoordinate[]): RouteBounds | null {
  if (points.length === 0) return null;
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  let north = Math.max(...lats);
  let south = Math.min(...lats);
  let east = Math.max(...lngs);
  let west = Math.min(...lngs);
  if (north - south < MIN_ROUTE_BOUNDS_SPAN_DEG) {
    const midLat = (north + south) / 2;
    north = midLat + MIN_ROUTE_BOUNDS_SPAN_DEG / 2;
    south = midLat - MIN_ROUTE_BOUNDS_SPAN_DEG / 2;
  }
  if (east - west < MIN_ROUTE_BOUNDS_SPAN_DEG) {
    const midLng = (east + west) / 2;
    east = midLng + MIN_ROUTE_BOUNDS_SPAN_DEG / 2;
    west = midLng - MIN_ROUTE_BOUNDS_SPAN_DEG / 2;
  }
  return { north, south, east, west };
}

/**
 * Encuadra el mapa para que todos los pines queden visibles: un zoom fijo sobre el centro no alcanza en un canvas
 * de 192 px para puntos alejados dentro de Aguilares. Solo vuelve a ajustar si cambian los límites.
 */
function RouteBoundsFitter({ bounds }: { bounds: RouteBounds }) {
  const map = useMap();
  const { north, south, east, west } = bounds;
  React.useEffect(() => {
    if (!map) return;
    map.fitBounds({ north, south, east, west }, ROUTE_BOUNDS_PADDING_PX);
  }, [map, north, south, east, west]);
  return null;
}

export interface TripRouteMapDrop {
  readonly position: number;
  readonly dropoffAddress: string;
  readonly dropoffZoneName: string;
  readonly dropoffLat?: number | null;
  readonly dropoffLng?: number | null;
  readonly status?: string;
}

export interface TripRouteMapProps {
  pickupAddress: string;
  pickupZoneName: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffAddress: string;
  dropoffZoneName: string;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  routeDistanceM?: number | null;
  showExternalNavigation?: boolean;
  title?: string;
  className?: string;
  drops?: readonly TripRouteMapDrop[];
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

export function TripRouteMap({
  pickupAddress,
  pickupZoneName,
  pickupLat,
  pickupLng,
  dropoffAddress,
  dropoffZoneName,
  dropoffLat,
  dropoffLng,
  routeDistanceM,
  showExternalNavigation = false,
  title = 'Recorrido en mapa',
  className,
  drops,
}: TripRouteMapProps) {
  let apiKey = '';
  let mapId: string | undefined;
  try {
    apiKey = publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
    mapId = publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined;
  } catch {
    // Resiliencia si el entorno público no está inicializado en tests o SSR
  }

  const [isOnline, setIsOnline] = React.useState<boolean>(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  });

  const [apiLoadFailed, setApiLoadFailed] = React.useState(false);

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

  const plan = React.useMemo(
    () =>
      buildTripRoutePlan({
        pickupAddress,
        pickupZoneName,
        pickupLat,
        pickupLng,
        dropoffAddress,
        dropoffZoneName,
        dropoffLat,
        dropoffLng,
        drops,
      }),
    [
      pickupAddress,
      pickupZoneName,
      pickupLat,
      pickupLng,
      dropoffAddress,
      dropoffZoneName,
      dropoffLat,
      dropoffLng,
      drops,
    ]
  );

  // Puntos con coordenada válida en orden de recorrido. Solo se dibujan si el plan tiene todos los puntos.
  const mappedStops = React.useMemo(
    () =>
      [plan.pickup, ...plan.drops].flatMap((stop) =>
        stop.coordinate ? [{ stop, coordinate: stop.coordinate }] : []
      ),
    [plan]
  );

  const isMapAvailable = Boolean(apiKey) && isOnline && !apiLoadFailed && plan.canDrawMap;

  const mapCenter = React.useMemo(() => {
    if (mappedStops.length === 0) {
      return { lat: -27.4333, lng: -65.6167 }; // Aguilares Centro
    }
    const avgLat =
      mappedStops.reduce((acc, item) => acc + item.coordinate.lat, 0) / mappedStops.length;
    const avgLng =
      mappedStops.reduce((acc, item) => acc + item.coordinate.lng, 0) / mappedStops.length;
    return { lat: Number(avgLat.toFixed(6)), lng: Number(avgLng.toFixed(6)) };
  }, [mappedStops]);

  const polylinePath = React.useMemo(
    () => mappedStops.map((item) => item.coordinate),
    [mappedStops]
  );

  const routeBounds = React.useMemo(() => computeRouteBounds(polylinePath), [polylinePath]);

  const formattedDistance = React.useMemo(() => {
    if (routeDistanceM == null || routeDistanceM < 1) return null;
    const km = routeDistanceM / 1000;
    const kmStr = km.toLocaleString('es-AR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `≈ ${kmStr} km`;
  }, [routeDistanceM]);

  // El fallback nombra la causa: primero los datos faltantes (no dependen del proveedor),
  // después la conexión, la carga del SDK y la key.
  const fallbackTitle = !plan.canDrawMap
    ? 'Sin ubicación exacta en el mapa'
    : !isOnline
      ? 'Mapa no disponible sin conexión'
      : apiLoadFailed
        ? 'No pudimos conectar con Google Maps'
        : 'Mapa no configurado';
  const guidance = showExternalNavigation
    ? 'Guiate por las direcciones escritas o abrí Google Maps.'
    : 'Guiate por las direcciones escritas.';

  return (
    <section
      data-testid="trip-route-map"
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-card shadow-card',
        className
      )}
    >
      {/* Cabecera del mapa */}
      <div className="flex items-center justify-between p-3.5 pb-2">
        <div className="flex items-center gap-2">
          <MapIcon className="h-5 w-5 text-primary" />
          <h2 className="font-display text-base font-bold text-foreground">{title}</h2>
        </div>
        <span
          data-testid="route-map-distance"
          className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground"
        >
          {formattedDistance ?? 'Distancia no calculada'}
        </span>
      </div>

      {/* Banner de estado offline si corresponde */}
      {!isOnline && (
        <div
          role="status"
          data-testid="route-map-offline-banner"
          className="mx-3.5 mb-2 flex items-center gap-2 rounded-lg border border-border bg-muted/60 p-2.5 text-xs text-muted-foreground"
        >
          <WifiOff className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>
            Modo sin conexión. Podés continuar con las direcciones escritas o abrir en Google Maps.
          </span>
        </div>
      )}

      {/* Canvas del mapa o Fallback */}
      <div
        className={cn(
          'relative w-full overflow-hidden border-y border-border bg-muted/30',
          isMapAvailable ? 'h-48' : 'min-h-48'
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
              defaultCenter={mapCenter}
              defaultZoom={14}
              gestureHandling="greedy"
              disableDefaultUI
              mapId={mapId}
            >
              {routeBounds && <RouteBoundsFitter bounds={routeBounds} />}
              {mappedStops.map((item, index) => (
                <RouteMarker
                  key={item.stop.label}
                  stop={item.stop}
                  coordinate={item.coordinate}
                  isPickup={index === 0}
                  testId={pinTestId(index)}
                  useAdvancedMarker={Boolean(mapId)}
                />
              ))}

              {/* Traza orientativa directa entre pines */}
              {polylinePath.length >= 2 && (
                <Polyline
                  path={polylinePath}
                  strokeColor="#0B7A7D"
                  strokeOpacity={0.8}
                  strokeWeight={4}
                />
              )}
            </GoogleMap>
          </APIProvider>
        ) : (
          <div
            data-testid="route-map-fallback"
            className="flex h-full w-full flex-col items-center justify-center p-4 text-center text-muted-foreground"
          >
            {!plan.canDrawMap ? (
              <MapPin className="mb-1.5 h-8 w-8 text-muted-foreground/60" />
            ) : !isOnline ? (
              <WifiOff className="mb-1.5 h-8 w-8 text-muted-foreground" />
            ) : apiLoadFailed ? (
              <AlertTriangle className="mb-1.5 h-8 w-8 text-destructive" />
            ) : (
              <MapPin className="mb-1.5 h-8 w-8 text-muted-foreground/60" />
            )}
            <p className="text-sm font-semibold text-foreground">{fallbackTitle}</p>
            {!plan.canDrawMap ? (
              <p className="mt-1 text-xs text-muted-foreground">
                No se marcó el punto en el mapa para{' '}
                <span data-testid="route-map-missing-points" className="font-semibold text-foreground">
                  {plan.missing.map((stop) => stop.label.toLowerCase()).join(', ')}
                </span>
                . {guidance}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">{guidance}</p>
            )}
            <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
              {[plan.pickup, ...plan.drops].map((stop) => (
                <li key={stop.label}>
                  {stop.label}: {stop.address} ({stop.zoneName})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Pie informativo para C06 (cuando no hay botón externo) */}
      {!showExternalNavigation && (
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-3.5 py-2 text-xs text-muted-foreground">
          <span>
            {pickupZoneName} → {dropoffZoneName}
          </span>
          <span className="font-medium text-primary-dark">Ruta directa sin desvíos</span>
        </div>
      )}

      {/* Navegación externa para R07: un botón de 48 px o un enlace por tramo */}
      {showExternalNavigation && <RouteNavigation legs={plan.navigationLegs} />}
    </section>
  );
}

const NAVIGATION_LINK_CLASS =
  'flex h-12 min-h-12 min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]';

function legSequence(leg: NavigationLeg): string {
  return leg.stops.map((stop) => stop.label).join(' → ');
}

/** Tramo que no entra en una URL de Google Maps: se navega con las direcciones escritas completas. */
function ManualLeg({ leg, heading }: { leg: NavigationLeg; heading: string }) {
  return (
    <div
      role="note"
      data-testid="route-navigation-manual-leg"
      className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground"
    >
      <p className="font-semibold text-foreground">{heading}</p>
      <p className="mt-1">
        Las direcciones son demasiado largas para abrir este tramo en Google Maps. Seguí las direcciones escritas:
      </p>
      <ol className="mt-1 space-y-0.5">
        {leg.stops.map((stop) => (
          <li key={stop.label}>
            {stop.label}: {stop.address}
          </li>
        ))}
      </ol>
    </div>
  );
}

function RouteNavigation({ legs }: { legs: readonly NavigationLeg[] }) {
  const [onlyLeg] = legs;
  if (legs.length === 1 && onlyLeg) {
    return (
      <div className="p-3.5">
        {onlyLeg.url ? (
          <a
            href={onlyLeg.url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="open-google-maps-btn"
            className={NAVIGATION_LINK_CLASS}
          >
            <ExternalLink className="h-4 w-4 text-primary" />
            <span>Abrir en Google Maps</span>
          </a>
        ) : (
          <ManualLeg leg={onlyLeg} heading={`Recorrido: ${legSequence(onlyLeg)}`} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3.5">
      <p className="text-xs text-muted-foreground">
        Google Maps abre hasta {MAX_NAVIGATION_WAYPOINTS + 2} paradas por enlace: el recorrido va en{' '}
        {legs.length} tramos, en orden. Cada tramo empieza donde terminó el anterior.
      </p>
      <ol className="space-y-2">
        {legs.map((leg, index) => {
          const heading = `Tramo ${index + 1} de ${legs.length}: ${legSequence(leg)}`;
          return (
            <li key={heading}>
              {leg.url ? (
                <a
                  href={leg.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`open-google-maps-leg-${index + 1}`}
                  className={cn(NAVIGATION_LINK_CLASS, 'h-auto flex-col gap-0.5 py-2')}
                >
                  <span className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-primary" />
                    Abrir tramo {index + 1} de {legs.length}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {legSequence(leg)}
                  </span>
                </a>
              ) : (
                <ManualLeg leg={leg} heading={heading} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function pinTestId(index: number): string {
  if (index === 0) return 'map-pin-pickup';
  return index === 1 ? 'map-pin-dropoff' : `map-pin-dropoff-${index}`;
}

function RouteMarker({
  stop,
  coordinate,
  isPickup,
  testId,
  useAdvancedMarker,
}: {
  stop: RouteStop;
  coordinate: RouteCoordinate;
  isPickup: boolean;
  testId: string;
  useAdvancedMarker: boolean;
}) {
  const markerTitle = `${stop.label}: ${stop.address}`;

  // AdvancedMarker solo se dibuja con Map ID; sin él se usa el Marker clásico, igual que src/ui/map.tsx.
  if (!useAdvancedMarker) {
    return (
      <Marker
        position={coordinate}
        title={markerTitle}
        label={isPickup ? 'R' : stop.label.replace(/\D/g, '') || 'E'}
      />
    );
  }

  return (
    <AdvancedMarker position={coordinate} title={markerTitle}>
      <div data-testid={testId} className="relative flex items-center justify-center">
        <div className="flex flex-col items-center">
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-bold shadow',
              isPickup ? 'bg-primary text-primary-foreground' : 'bg-foreground text-background'
            )}
          >
            {stop.label}
          </span>
          <div
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full shadow-md ring-2 ring-background',
              isPickup ? 'bg-primary text-primary-foreground' : 'bg-foreground text-background'
            )}
          >
            {isPickup ? <Store className="h-4 w-4" /> : <MapPin className="h-4 w-4 text-primary" />}
          </div>
        </div>
      </div>
    </AdvancedMarker>
  );
}
