export interface GoogleMapsDirectionsOptions {
  origin: string | { lat: number; lng: number };
  destination: string | { lat: number; lng: number };
  waypoints?: Array<string | { lat: number; lng: number }>;
}

function serializeEndpoint(endpoint: string | { lat: number; lng: number }): string {
  if (typeof endpoint === 'string') {
    return endpoint;
  }
  return `${endpoint.lat},${endpoint.lng}`;
}

/**
 * Construye el enlace universal canónico de navegación para Google Maps.
 * Cada punto se serializa (coordenadas como lat,lng o texto tal cual)
 * y se codifica individualmente con encodeURIComponent.
 * Soporta waypoints intermedios en orden para navegación multi-drop.
 */
export function buildGoogleMapsDirectionsUrl(options: GoogleMapsDirectionsOptions): string {
  const originStr = serializeEndpoint(options.origin);
  const destStr = serializeEndpoint(options.destination);

  const encodedOrigin = encodeURIComponent(originStr);
  const encodedDest = encodeURIComponent(destStr);

  let url = `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&destination=${encodedDest}`;
  if (options.waypoints && options.waypoints.length > 0) {
    const waypointsStr = options.waypoints.map(serializeEndpoint).join('|');
    url += `&waypoints=${encodeURIComponent(waypointsStr)}`;
  }
  return url;
}
