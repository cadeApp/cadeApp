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

export interface TripRoutePlan {
  readonly pickup: RouteStop;
  readonly drops: readonly RouteStop[];
  /** Puntos sin coordenada válida dentro de Aguilares, en orden de recorrido. */
  readonly missing: readonly RouteStop[];
  /** Solo hay mapa cuando el retiro y todas las entregas tienen coordenada válida. */
  readonly canDrawMap: boolean;
  readonly externalUrl: string;
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
 * mapa y el enlace a Google Maps. El enlace incluye todas las entregas en orden; cada punto va como coordenada si
 * es válida y, si no, como la dirección escrita por el comercio, sin inventar ubicaciones.
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
  const lastDrop = drops[drops.length - 1] ?? drops[0];
  const intermediate = drops.slice(0, -1).map(toUrlEndpoint);

  const externalUrl = buildGoogleMapsDirectionsUrl({
    origin: toUrlEndpoint(pickup),
    destination: lastDrop ? toUrlEndpoint(lastDrop) : input.dropoffAddress,
    waypoints: intermediate.length > 0 ? intermediate : undefined,
  });

  return {
    pickup,
    drops,
    missing,
    canDrawMap: missing.length === 0,
    externalUrl,
  };
}
