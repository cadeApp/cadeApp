export interface GoogleMapsDirectionsOptions {
  origin: string | { lat: number; lng: number };
  destination: string | { lat: number; lng: number };
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
 */
export function buildGoogleMapsDirectionsUrl(
  options: GoogleMapsDirectionsOptions
): string {
  const originStr = serializeEndpoint(options.origin);
  const destStr = serializeEndpoint(options.destination);

  const encodedOrigin = encodeURIComponent(originStr);
  const encodedDest = encodeURIComponent(destStr);

  return `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&destination=${encodedDest}`;
}
