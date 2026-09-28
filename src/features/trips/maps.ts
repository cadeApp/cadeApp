export interface GoogleMapsDirectionsOptions {
  origin: string | { lat: number; lng: number };
  destination: string | { lat: number; lng: number };
}

/**
 * Stub inicial en fase roja (TDD) para T-117.
 */
export function buildGoogleMapsDirectionsUrl(
  _options: GoogleMapsDirectionsOptions
): string {
  return '';
}
