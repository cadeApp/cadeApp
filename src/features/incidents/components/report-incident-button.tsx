'use client';

/** Quién puede reportar desde el viaje (D05-A). El admin nunca recibe este camino. */
export type IncidentReporterRole = 'merchant' | 'courier';

export interface ReportIncidentButtonProps {
  readonly requestId: string;
  readonly actorRole: IncidentReporterRole;
  readonly tripStatus: string;
  readonly deliveredAt: string | null;
}

/**
 * C06/R07: botón «Reportar un problema» con su formulario. Pendiente de implementación (T-124).
 */
export function ReportIncidentButton(_props: ReportIncidentButtonProps) {
  return null;
}
