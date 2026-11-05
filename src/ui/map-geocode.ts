/**
 * CC-045: helpers puros para ubicar una dirección escrita. Viven fuera de `map.tsx` para que los formularios los
 * usen sin cargar `@vis.gl/react-google-maps` (el mapa se importa dinámico); `map.tsx` los reexporta.
 */
import { AGUILARES_BOUNDS, isWithinAguilaresBounds } from '@/domain/schemas';

export interface MapGeocodeCoordinates {
  lat: number;
  lng: number;
}

/** CC-045: pedido de búsqueda. Cambiar `id` dispara una búsqueda nueva aunque `query` sea igual. */
export interface MapGeocodeRequest {
  readonly id: number;
  readonly query: string;
}

export type MapGeocodeOutcome =
  | { readonly status: 'found'; readonly coords: MapGeocodeCoordinates; readonly approximate: boolean }
  | { readonly status: 'outside' }
  | { readonly status: 'not_found' }
  | { readonly status: 'unavailable' };

/** Lo que usa `interpretGeocodeResponse` de un `google.maps.GeocoderResult`. */
export interface GeocoderResultLike {
  readonly geometry: {
    readonly location: { lat: number | (() => number); lng: number | (() => number) };
    readonly location_type?: string;
  };
  readonly partial_match?: boolean;
}

/** CC-045: «dirección, barrio, Aguilares, Tucumán, Argentina». Sin dirección no hay consulta (`''`). */
export function buildGeocodeQuery(address: string, zoneName?: string | null): string {
  const street = address.trim();
  if (!street) return '';
  return [street, zoneName?.trim(), 'Aguilares', 'Tucumán', 'Argentina'].filter(Boolean).join(', ');
}


/** CC-045: primer resultado del Geocoder; `status` es `OK` o el código de error de Google. */
export function interpretGeocodeResponse(
  results: readonly GeocoderResultLike[] | null,
  status: string
): MapGeocodeOutcome {
  if (status === 'ZERO_RESULTS') return { status: 'not_found' };
  if (status !== 'OK') return { status: 'unavailable' };
  const first = results?.[0];
  if (!first) return { status: 'not_found' };
  const { location, location_type } = first.geometry;
  const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
  const lng = typeof location.lng === 'function' ? location.lng() : location.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { status: 'unavailable' };
  if (!isWithinAguilaresBounds(lat, lng)) return { status: 'outside' };
  return {
    status: 'found',
    coords: { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) },
    // Solo ROOFTOP sin partial_match es exacto; RANGE_INTERPOLATED, GEOMETRIC_CENTER y APPROXIMATE no.
    approximate: location_type !== 'ROOFTOP' || first.partial_match === true,
  };
}

export const AGUILARES_LAT_LNG_BOUNDS = {
  north: AGUILARES_BOUNDS.maxLat,
  south: AGUILARES_BOUNDS.minLat,
  east: AGUILARES_BOUNDS.maxLng,
  west: AGUILARES_BOUNDS.minLng,
};
