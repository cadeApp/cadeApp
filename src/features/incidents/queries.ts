import 'server-only';

import type { IncidentInboxTab } from './schemas';
import type { IncidentDetail, IncidentsQueueResult } from './types';

export interface GetIncidentsQueueOptions {
  readonly tab?: IncidentInboxTab;
  readonly cursor?: string;
  readonly pageSize?: number;
}

/**
 * A05: bandeja de incidentes paginada server-side, con el cliente de sesión (RLS del admin).
 */
export async function getIncidentsQueue(
  _options?: GetIncidentsQueueOptions
): Promise<IncidentsQueueResult> {
  throw new Error('T-124: sin implementar');
}

/**
 * A05: detalle del incidente con las partes del viaje y su cronología. Nunca datos del destinatario.
 */
export async function getIncidentDetail(_incidentId: string): Promise<IncidentDetail | null> {
  throw new Error('T-124: sin implementar');
}
