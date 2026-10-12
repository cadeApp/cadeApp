'use client';

import * as React from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  Polyline,
  useApiLoadingStatus,
  APILoadingStatus,
} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  ExternalLink,
  Map as MapIcon,
  MapPin,
  Store,
  WifiOff,
} from 'lucide-react';
import { publicEnv } from '@/lib/env.public';
import { cn } from '@/ui/cn';
import { buildGoogleMapsDirectionsUrl } from '../maps';

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

  const dropsWithCoords = React.useMemo(() => {
    if (!drops || drops.length === 0) return null;
    const valid = drops.filter((d) => d.dropoffLat != null && d.dropoffLng != null);
    return valid.length > 0 ? valid : null;
  }, [drops]);

  const hasCoords =
    pickupLat != null &&
    pickupLng != null &&
    (dropsWithCoords != null || (dropoffLat != null && dropoffLng != null));

  const isMapAvailable = Boolean(apiKey) && isOnline && !apiLoadFailed && hasCoords;

  const mapCenter = React.useMemo(() => {
    if (pickupLat != null && pickupLng != null) {
      if (dropsWithCoords && dropsWithCoords.length > 0) {
        const allLats = [pickupLat, ...dropsWithCoords.map((d) => d.dropoffLat!)];
        const allLngs = [pickupLng, ...dropsWithCoords.map((d) => d.dropoffLng!)];
        const avgLat = allLats.reduce((a, b) => a + b, 0) / allLats.length;
        const avgLng = allLngs.reduce((a, b) => a + b, 0) / allLngs.length;
        return {
          lat: Number(avgLat.toFixed(6)),
          lng: Number(avgLng.toFixed(6)),
        };
      }
      if (dropoffLat != null && dropoffLng != null) {
        return {
          lat: Number(((pickupLat + dropoffLat) / 2).toFixed(6)),
          lng: Number(((pickupLng + dropoffLng) / 2).toFixed(6)),
        };
      }
    }
    return { lat: -27.4333, lng: -65.6167 }; // Aguilares Centro
  }, [pickupLat, pickupLng, dropsWithCoords, dropoffLat, dropoffLng]);

  const polylinePath = React.useMemo(() => {
    if (pickupLat == null || pickupLng == null) return [];
    if (dropsWithCoords && dropsWithCoords.length > 0) {
      return [
        { lat: pickupLat, lng: pickupLng },
        ...dropsWithCoords.map((d) => ({ lat: d.dropoffLat!, lng: d.dropoffLng! })),
      ];
    }
    if (dropoffLat != null && dropoffLng != null) {
      return [
        { lat: pickupLat, lng: pickupLng },
        { lat: dropoffLat, lng: dropoffLng },
      ];
    }
    return [];
  }, [pickupLat, pickupLng, dropsWithCoords, dropoffLat, dropoffLng]);

  const externalMapUrl = React.useMemo(() => {
    if (pickupLat != null && pickupLng != null) {
      const destLat = dropsWithCoords
        ? dropsWithCoords[dropsWithCoords.length - 1]?.dropoffLat
        : dropoffLat;
      const destLng = dropsWithCoords
        ? dropsWithCoords[dropsWithCoords.length - 1]?.dropoffLng
        : dropoffLng;
      if (destLat != null && destLng != null) {
        return buildGoogleMapsDirectionsUrl({
          origin: { lat: pickupLat, lng: pickupLng },
          destination: { lat: destLat, lng: destLng },
        });
      }
    }
    return buildGoogleMapsDirectionsUrl({
      origin: pickupAddress,
      destination: dropoffAddress,
    });
  }, [pickupLat, pickupLng, dropsWithCoords, dropoffLat, dropoffLng, pickupAddress, dropoffAddress]);

  const formattedDistance = React.useMemo(() => {
    if (routeDistanceM == null || routeDistanceM < 1) return null;
    const km = routeDistanceM / 1000;
    const kmStr = km.toLocaleString('es-AR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `≈ ${kmStr} km`;
  }, [routeDistanceM]);

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
        {formattedDistance && (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
            {formattedDistance}
          </span>
        )}
      </div>

      {/* Banner de estado offline si corresponde */}
      {!isOnline && (
        <div
          role="status"
          data-testid="route-map-offline-banner"
          className="mx-3.5 mb-2 flex items-center gap-2 rounded-lg border border-border bg-muted/60 p-2.5 text-xs text-muted-foreground"
        >
          <WifiOff className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>Modo sin conexión. Podés continuar con las direcciones escritas o abrir en Google Maps.</span>
        </div>
      )}

      {/* Canvas del mapa o Fallback */}
      <div className="relative h-48 w-full overflow-hidden border-y border-border bg-muted/30">
        {isMapAvailable ? (
          <APIProvider
            apiKey={apiKey}
            onError={() => {
              setApiLoadFailed(true);
            }}
          >
            <MapStatusWatcher onFailed={() => setApiLoadFailed(true)} />
            <GoogleMap
              center={mapCenter}
              defaultZoom={14}
              gestureHandling="greedy"
              disableDefaultUI
              mapId={mapId}
            >
              {/* Pin 1: Retiro */}
              <AdvancedMarker
                position={{ lat: pickupLat, lng: pickupLng }}
                title={`Retiro: ${pickupAddress}`}
              >
                <div
                  data-testid="map-pin-pickup"
                  className="relative flex items-center justify-center"
                >
                  <div className="flex flex-col items-center">
                    <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow">
                      Retiro
                    </span>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background">
                      <Store className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </AdvancedMarker>

              {/* Pines de Entrega */}
              {dropsWithCoords && dropsWithCoords.length > 0 ? (
                dropsWithCoords.map((d) => (
                  <AdvancedMarker
                    key={d.position}
                    position={{ lat: d.dropoffLat!, lng: d.dropoffLng! }}
                    title={`Entrega ${d.position}: ${d.dropoffAddress}`}
                  >
                    <div
                      data-testid={d.position === 1 ? 'map-pin-dropoff' : `map-pin-dropoff-${d.position}`}
                      className="relative flex items-center justify-center"
                    >
                      <div className="flex flex-col items-center">
                        <span className="rounded bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-background shadow">
                          Entrega {d.position}
                        </span>
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background shadow-md ring-2 ring-background">
                          <MapPin className="h-4 w-4 text-primary" />
                        </div>
                      </div>
                    </div>
                  </AdvancedMarker>
                ))
              ) : (
                <AdvancedMarker
                  position={{ lat: dropoffLat!, lng: dropoffLng! }}
                  title={`Entrega: ${dropoffAddress}`}
                >
                  <div
                    data-testid="map-pin-dropoff"
                    className="relative flex items-center justify-center"
                  >
                    <div className="flex flex-col items-center">
                      <span className="rounded bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-background shadow">
                        Entrega
                      </span>
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background shadow-md ring-2 ring-background">
                        <MapPin className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                  </div>
                </AdvancedMarker>
              )}

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
            {apiLoadFailed ? (
              <AlertTriangle className="mb-1.5 h-8 w-8 text-destructive" />
            ) : !isOnline ? (
              <WifiOff className="mb-1.5 h-8 w-8 text-muted-foreground" />
            ) : (
              <MapPin className="mb-1.5 h-8 w-8 text-muted-foreground/60" />
            )}
            <p className="text-sm font-semibold text-foreground">
              {!isOnline
                ? 'Mapa no disponible sin conexión'
                : apiLoadFailed
                  ? 'No pudimos conectar con Google Maps'
                  : !apiKey
                    ? 'Mapa no configurado'
                    : 'Mapa en modo simplificado'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {pickupAddress} ({pickupZoneName}) → {dropoffAddress} ({dropoffZoneName})
            </p>
          </div>
        )}
      </div>

      {/* Pie informativo para C06 (cuando no hay botón externo) */}
      {!showExternalNavigation && (
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-3.5 py-2 text-xs text-muted-foreground">
          <span>{pickupZoneName} → {dropoffZoneName}</span>
          <span className="font-medium text-primary-dark">Ruta directa sin desvíos</span>
        </div>
      )}

      {/* Botón externo prominente de 48 px para R07 */}
      {showExternalNavigation && (
        <div className="p-3.5">
          <a
            href={externalMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="open-google-maps-btn"
            className="flex h-12 min-h-12 min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ExternalLink className="h-4 w-4 text-primary" />
            <span>Abrir en Google Maps</span>
          </a>
        </div>
      )}
    </section>
  );
}
