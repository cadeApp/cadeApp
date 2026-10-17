import { aguilaresLatSchema, aguilaresLngSchema } from '@/domain';
import { buildGoogleMapsDirectionsUrl } from './maps';

export interface RouteCoordinate {
  readonly lat: number;
  readonly lng: number;
}

export interface RouteStop {
  /** «Retiro» o «Entrega N», para explicar qué punto no tiene ubicación exacta. */
  readonly label: string;
  readonly address: string;
  readonly zoneName: string;
  readonly coordinate: RouteCoordinate | null;
}

/** Google Maps URLs admite hasta 3 paradas intermedias en el navegador móvil. */
export const MAX_NAVIGATION_WAYPOINTS = 3;
/** Largo máximo de una URL de Google Maps URLs. */
export const MAX_NAVIGATION_URL_LENGTH = 2048;

export interface NavigationLeg {
  /** Paradas del tramo en orden: origen, intermedias y destino. */
  readonly stops: readonly RouteStop[];
  /** Enlace a Google Maps, o null si ni el par origen/destino entra en una URL válida. */
  readonly url: string | null;
}

export interface TripRoutePlan {
  readonly pickup: RouteStop;
  readonly drops: readonly RouteStop[];
  /** Puntos sin coordenada válida dentro de Aguilares, en orden de recorrido. */
  readonly missing: readonly RouteStop[];
  /** Solo hay mapa cuando el retiro y todas las entregas tienen coordenada válida. */
  readonly canDrawMap: boolean;
  /** Recorrido completo partido en tramos navegables (ver {@link buildNavigationLegs}). */
  readonly navigationLegs: readonly NavigationLeg[];
}

interface RouteInputDrop {
  readonly position: number;
  readonly dropoffAddress: string;
  readonly dropoffZoneName: string;
  readonly dropoffLat?: number | null;
  readonly dropoffLng?: number | null;
}

export interface TripRouteInput {
  readonly pickupAddress: string;
  readonly pickupZoneName: string;
  readonly pickupLat?: number | null;
  readonly pickupLng?: number | null;
  readonly dropoffAddress: string;
  readonly dropoffZoneName: string;
  readonly dropoffLat?: number | null;
  readonly dropoffLng?: number | null;
  readonly drops?: readonly RouteInputDrop[];
}

/**
 * Una coordenada solo es válida si ambos valores son finitos y caen dentro del área de servicio de Aguilares,
 * con los mismos límites que valida la RPC. Cualquier otro valor se trata como faltante: nunca se dibuja ni se
 * manda a Google Maps.
 */
export function toValidCoordinate(
  lat: number | null | undefined,
  lng: number | null | undefined
): RouteCoordinate | null {
  if (!aguilaresLatSchema.safeParse(lat).success || !aguilaresLngSchema.safeParse(lng).success) {
    return null;
  }
  return { lat: Number(lat), lng: Number(lng) };
}

function toUrlEndpoint(stop: RouteStop): string | RouteCoordinate {
  return stop.coordinate ?? stop.address;
}

/**
 * Arma el recorrido del viaje: cada punto con su coordenada válida o sin ella, qué puntos faltan para dibujar el
 * mapa y los tramos de navegación. Los tramos cubren todas las entregas en orden de `position`; cada punto va como
 * coordenada si es válida y, si no, como la dirección escrita por el comercio, sin inventar ubicaciones.
 */
export function buildTripRoutePlan(input: TripRouteInput): TripRoutePlan {
  const pickup: RouteStop = {
    label: 'Retiro',
    address: input.pickupAddress,
    zoneName: input.pickupZoneName,
    coordinate: toValidCoordinate(input.pickupLat, input.pickupLng),
  };

  const sourceDrops = input.drops && input.drops.length > 0 ? [...input.drops] : null;
  const drops: RouteStop[] = sourceDrops
    ? sourceDrops
        .sort((a, b) => a.position - b.position)
        .map((drop) => ({
          label: sourceDrops.length > 1 ? `Entrega ${drop.position}` : 'Entrega',
          address: drop.dropoffAddress,
          zoneName: drop.dropoffZoneName,
          coordinate: toValidCoordinate(drop.dropoffLat, drop.dropoffLng),
        }))
    : [
        {
          label: 'Entrega',
          address: input.dropoffAddress,
          zoneName: input.dropoffZoneName,
          coordinate: toValidCoordinate(input.dropoffLat, input.dropoffLng),
        },
      ];

  const missing = [pickup, ...drops].filter((stop) => stop.coordinate == null);

  return {
    pickup,
    drops,
    missing,
    canDrawMap: missing.length === 0,
    navigationLegs: buildNavigationLegs([pickup, ...drops]),
  };
}

function buildLegUrl(stops: readonly RouteStop[]): string {
  const origin = stops[0];
  const destination = stops[stops.length - 1];
  if (!origin || !destination) {
    throw new Error('Un tramo de navegación necesita origen y destino');
  }
  const waypoints = stops.slice(1, -1).map(toUrlEndpoint);
  return buildGoogleMapsDirectionsUrl({
    origin: toUrlEndpoint(origin),
    destination: toUrlEndpoint(destination),
    waypoints: waypoints.length > 0 ? waypoints : undefined,
  });
}

/**
 * Parte el recorrido en tramos que Google Maps puede abrir: cada tramo tiene origen, destino y como máximo
 * {@link MAX_NAVIGATION_WAYPOINTS} paradas intermedias, y su URL no supera {@link MAX_NAVIGATION_URL_LENGTH}
 * caracteres. El destino de un tramo se repite como origen del siguiente, así no se pierde ninguna parada. Si ni
 * siquiera el par origen/destino entra en una URL, ese tramo queda sin enlace (`url: null`) para navegarlo a mano
 * con las direcciones escritas: nunca se recorta una dirección.
 */
export function buildNavigationLegs(stops: readonly RouteStop[]): NavigationLeg[] {
  const legs: NavigationLeg[] = [];
  let start = 0;

  while (start < stops.length - 1) {
    let end = Math.min(start + MAX_NAVIGATION_WAYPOINTS + 1, stops.length - 1);
    let leg: NavigationLeg | null = null;

    while (end > start) {
      const legStops = stops.slice(start, end + 1);
      const url = buildLegUrl(legStops);
      if (url.length <= MAX_NAVIGATION_URL_LENGTH) {
        leg = { stops: legStops, url };
        break;
      }
      if (end === start + 1) {
        leg = { stops: legStops, url: null };
        break;
      }
      end -= 1;
    }

    if (!leg) {
      throw new Error('No se pudo armar el tramo de navegación');
    }
    legs.push(leg);
    start = end;
  }

  return legs;
}
