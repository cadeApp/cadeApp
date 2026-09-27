import type { IncidentStatus } from '@/domain';

export type IncidentReporterRole = 'merchant' | 'courier' | 'admin';

export interface IncidentListItem {
  readonly id: string;
  readonly requestId: string;
  readonly kind: string;
  readonly excerpt: string;
  readonly status: IncidentStatus;
  readonly createdAt: string;
  readonly reporterRole: IncidentReporterRole;
  readonly reporterName: string;
}

export interface IncidentsQueueResult {
  readonly items: readonly IncidentListItem[];
  readonly pageSize: number;
  readonly nextCursor: string | null;
  readonly hasNextPage: boolean;
}

/** Parte del viaje (comercio o repartidor) para mediación manual. Nunca datos del destinatario. */
export interface IncidentParty {
  readonly id: string;
  readonly name: string;
  readonly phone: string | null;
}

export interface IncidentTimeline {
  readonly publishedAt: string | null;
  readonly matchedAt: string | null;
  readonly pickedUpAt: string | null;
  readonly deliveredAt: string | null;
}

export interface IncidentDetail {
  readonly id: string;
  readonly requestId: string;
  readonly kind: string;
  readonly description: string;
  readonly status: IncidentStatus;
  readonly resolution: string | null;
  readonly createdAt: string;
  readonly reporterRole: IncidentReporterRole;
  readonly reporterName: string;
  readonly merchant: IncidentParty;
  readonly courier: IncidentParty | null;
  readonly courierSuspended: boolean;
  readonly timeline: IncidentTimeline;
}
