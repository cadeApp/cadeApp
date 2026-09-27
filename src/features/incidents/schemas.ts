/** Tipos de incidente que puede reportar el comercio o el repartidor desde el viaje (C06/R07). */
export const INCIDENT_KINDS = [
  'no_show',
  'payment_issue',
  'damaged_goods',
  'safety',
  'other',
] as const;
export type IncidentKind = (typeof INCIDENT_KINDS)[number];

/** Decisión tipificada de resolución (D04); la registra `admin_resolve_incident` (CC pendiente, D03). */
export const INCIDENT_DECISIONS = ['no_action', 'warning', 'preventive_suspension'] as const;
export type IncidentDecision = (typeof INCIDENT_DECISIONS)[number];

/** Pestañas de la bandeja A05: abiertos (`open`, `reviewing`) y cerrados (`resolved`, `dismissed`). */
export const INCIDENT_INBOX_TABS = ['open', 'closed'] as const;
export type IncidentInboxTab = (typeof INCIDENT_INBOX_TABS)[number];

export interface ReportIncidentInput {
  readonly requestId: string;
  readonly kind: IncidentKind;
  readonly description: string;
}

export interface SuspendCourierForIncidentInput {
  readonly incidentId: string;
  readonly courierId: string;
  readonly reason: string;
}

export interface ResolveIncidentInput {
  readonly incidentId: string;
  readonly decision: IncidentDecision;
  readonly reason: string;
}

export interface IncidentsSearchParams {
  readonly tab: IncidentInboxTab;
  readonly cursor?: string;
}

export function parseIncidentsSearchParams(_raw: {
  tab?: unknown;
  cursor?: unknown;
}): IncidentsSearchParams {
  throw new Error('T-124: sin implementar');
}
