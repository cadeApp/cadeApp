import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { buttonVariants } from '@/ui/button';
import { cn } from '@/ui/cn';
import { REPORT_TRIGGER_COPY } from '../report-trigger-copy';
import { canReportIncident } from '../report-window';
import { ReportIncidentTrigger } from './report-incident-trigger';

/** Quién puede reportar desde el viaje (D05-A). El admin nunca recibe este camino. */
export type IncidentReporterRole = 'merchant' | 'courier';

export interface ReportIncidentButtonProps {
  readonly requestId: string;
  readonly actorRole: IncidentReporterRole;
  readonly tripStatus: string;
  readonly deliveredAt: string | null;
  /**
   * Instante (ms) con el que se evalúa la ventana de 24 h. La page lo fija en el servidor al renderizar; sin él se usa
   * el reloj local.
   */
  readonly now?: number;
  /**
   * T-389: `ghost` es el estilo de «No puedo hacer este viaje», para el viaje del repartidor (va dentro de su vista,
   * por encima de la barra fija). Por defecto, `outline` (vista del comercio).
   */
  readonly variant?: 'outline' | 'ghost';
}

/**
 * C06/R07: botón «Reportar un problema» que abre el formulario en un Dialog. Muestra el botón según D05-A; Postgres
 * vuelve a validar actor, ventana y relato en `report_incident`.
 *
 * No es componente cliente: la ventana, el ícono y el texto se resuelven al renderizar en el servidor y al navegador solo
 * viaja la isla `ReportIncidentTrigger`.
 */
export function ReportIncidentButton({
  requestId,
  actorRole,
  tripStatus,
  deliveredAt,
  now,
  variant = 'outline',
}: ReportIncidentButtonProps) {
  if (!canReportIncident({ actorRole, tripStatus, deliveredAt }, now ?? Date.now())) {
    return null;
  }

  return (
    <div className="space-y-3">
      <ReportIncidentTrigger
        requestId={requestId}
        className={cn(
          buttonVariants({ variant }),
          'w-full',
          variant === 'ghost' && 'min-h-12 text-muted-foreground hover:text-destructive'
        )}
        loadingLabel={REPORT_TRIGGER_COPY.loading}
      >
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        {REPORT_TRIGGER_COPY.label}
      </ReportIncidentTrigger>
    </div>
  );
}
