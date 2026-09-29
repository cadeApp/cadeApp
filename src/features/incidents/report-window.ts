const DELIVERED_REPORT_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ReportWindowInput {
  readonly actorRole: string;
  readonly tripStatus: string;
  readonly deliveredAt: string | null;
}

/**
 * D05-A, solo para mostrar u ocultar el botón (la autoridad es `report_incident` en Postgres):
 * comercio dueño en `matched`, `in_transit` y hasta 24 h inclusive después de `delivered`;
 * repartidor asignado solo en `matched` e `in_transit`; el admin nunca.
 */
export function canReportIncident(
  { actorRole, tripStatus, deliveredAt }: ReportWindowInput,
  now: number
): boolean {
  if (actorRole !== 'merchant' && actorRole !== 'courier') {
    return false;
  }
  if (tripStatus === 'matched' || tripStatus === 'in_transit') {
    return true;
  }
  if (tripStatus !== 'delivered' || actorRole !== 'merchant' || !deliveredAt) {
    return false;
  }
  const deliveredAtMs = Date.parse(deliveredAt);
  return Number.isFinite(deliveredAtMs) && now - deliveredAtMs <= DELIVERED_REPORT_WINDOW_MS;
}
