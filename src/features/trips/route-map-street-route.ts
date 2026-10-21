import type { RouteCoordinate } from './route-points';

/**
 * Compute Routes Essentials admite hasta 10 puntos intermedios con las funciones básicas. Con más, el viaje usa la
 * línea recta orientativa: no se reordenan paradas ni se parte el cálculo en tramos (T-377).
 */
export const MAX_STREET_ROUTE_INTERMEDIATES = 10;

/** Espera máxima a que cargue la biblioteca `routes` antes de admitir que la ruta por calles no está disponible. */
export const ROUTES_LIBRARY_TIMEOUT_MS = 10_000;

export interface StreetRouteRequest {
  readonly origin: RouteCoordinate;
  readonly destination: RouteCoordinate;
  readonly intermediates: ReadonlyArray<{ readonly location: RouteCoordinate }>;
  readonly travelMode: 'DRIVING';
  readonly fields: readonly ['path'];
  readonly optimizeWaypointOrder: false;
}

/**
 * Pedido a `Route.computeRoutes` para los puntos en orden de recorrido (retiro, entregas por `position`). Devuelve
 * null si no hay al menos origen y destino o si las intermedias superan {@link MAX_STREET_ROUTE_INTERMEDIATES}.
 */
export function buildStreetRouteRequest(points: readonly RouteCoordinate[]): StreetRouteRequest | null {
  const origin = points[0];
  const destination = points.at(-1);
  if (points.length < 2 || !origin || !destination) return null;
  const intermediates = points.slice(1, -1);
  if (intermediates.length > MAX_STREET_ROUTE_INTERMEDIATES) return null;
  return {
    origin: { lat: origin.lat, lng: origin.lng },
    destination: { lat: destination.lat, lng: destination.lng },
    intermediates: intermediates.map((point) => ({ location: { lat: point.lat, lng: point.lng } })),
    travelMode: 'DRIVING',
    fields: ['path'],
    optimizeWaypointOrder: false,
  };
}

/** Clave estable de la secuencia de puntos: misma clave, misma ruta; no se recalcula por un rerender. */
export function streetRouteKey(points: readonly RouteCoordinate[]): string {
  return points.map((point) => `${point.lat},${point.lng}`).join('|');
}

function readCoordinate(point: unknown): RouteCoordinate | null {
  if (typeof point !== 'object' || point === null) return null;
  // google.maps.LatLngAltitude expone lat/lng como getters: se leen por propiedad, no con Object.keys.
  const { lat, lng } = point as { lat?: unknown; lng?: unknown };
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * Geometría de `routes[0].path` como `{ lat, lng }`. Devuelve null si no hay ruta, si tiene menos de dos puntos o
 * si algún punto no es una coordenada finita: en ese caso se usa la línea recta.
 */
export function extractStreetRoutePath(result: unknown): RouteCoordinate[] | null {
  if (typeof result !== 'object' || result === null) return null;
  const { routes } = result as { routes?: unknown };
  if (!Array.isArray(routes)) return null;
  const first: unknown = routes[0];
  if (typeof first !== 'object' || first === null) return null;
  const { path } = first as { path?: unknown };
  if (!Array.isArray(path) || path.length < 2) return null;
  const coordinates: RouteCoordinate[] = [];
  for (const point of path) {
    const coordinate = readCoordinate(point);
    if (!coordinate) return null;
    coordinates.push(coordinate);
  }
  return coordinates;
}

type ComputeRoutes = (request: StreetRouteRequest) => Promise<unknown>;

/** `Route.computeRoutes` de la biblioteca `routes`, o null si la biblioteca cargada no la trae. */
export function getComputeRoutes(routesLibrary: unknown): ComputeRoutes | null {
  if (typeof routesLibrary !== 'object' || routesLibrary === null) return null;
  const { Route } = routesLibrary as { Route?: unknown };
  if ((typeof Route !== 'function' && typeof Route !== 'object') || Route === null) return null;
  const { computeRoutes } = Route as { computeRoutes?: unknown };
  if (typeof computeRoutes !== 'function') return null;
  return (request) => Promise.resolve((computeRoutes as ComputeRoutes).call(Route, request));
}
