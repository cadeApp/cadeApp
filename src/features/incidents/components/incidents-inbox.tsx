import type { IncidentInboxTab } from '../schemas';
import type { IncidentsQueueResult } from '../types';

export interface IncidentsInboxProps {
  readonly result: IncidentsQueueResult;
  readonly tab: IncidentInboxTab;
  readonly currentCursor?: string;
}

/**
 * A05: bandeja de incidentes. Pendiente de implementación (T-124).
 */
export function IncidentsInbox(_props: IncidentsInboxProps) {
  return null;
}
