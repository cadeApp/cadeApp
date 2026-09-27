'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { buttonVariants } from '@/ui/button';
import { cn } from '@/ui/cn';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/dialog';
import { Skeleton } from '@/ui/skeleton';
import { INCIDENTS_COPY } from '../copy';
import { canReportIncident } from '../report-window';

const COPY = INCIDENTS_COPY.report;

// El formulario (react-hook-form, Zod y contratos) se descarga recién al abrir el Dialog: reportar es poco frecuente y
// /trips/[id] tiene presupuesto de First Load JS (regla 25).
const ReportIncidentForm = React.lazy(() =>
  import('./report-incident-form').then((module) => ({ default: module.ReportIncidentForm }))
);

/** Quién puede reportar desde el viaje (D05-A). El admin nunca recibe este camino. */
export type IncidentReporterRole = 'merchant' | 'courier';

export interface ReportIncidentButtonProps {
  readonly requestId: string;
  readonly actorRole: IncidentReporterRole;
  readonly tripStatus: string;
  readonly deliveredAt: string | null;
  /**
   * Instante (ms) con el que se evalúa la ventana de 24 h. La page lo fija en el servidor para que el render SSR y la
   * hidratación decidan lo mismo; sin él se usa el reloj local.
   */
  readonly now?: number;
}

function ReportIncidentFormSkeleton() {
  return (
    <div role="status" aria-busy="true" className="mt-4 space-y-3">
      <span className="sr-only">{COPY.loading}</span>
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

/**
 * C06/R07: botón «Reportar un problema» con su formulario en un Dialog. Muestra el botón según D05-A; Postgres vuelve
 * a validar actor, ventana y relato en `report_incident`.
 */
export function ReportIncidentButton({
  requestId,
  actorRole,
  tripStatus,
  deliveredAt,
  now,
}: ReportIncidentButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  if (!canReportIncident({ actorRole, tripStatus, deliveredAt }, now ?? Date.now())) {
    return null;
  }

  function handleOpenChange(next: boolean) {
    if (!next && pending) return;
    setOpen(next);
  }

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}>
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          {COPY.trigger}
        </DialogTrigger>
        <DialogContent preventCloseOnEscape={pending} className="max-h-full overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{COPY.title}</DialogTitle>
            <DialogDescription>{COPY.description}</DialogDescription>
          </DialogHeader>
          <React.Suspense fallback={<ReportIncidentFormSkeleton />}>
            <ReportIncidentForm
              requestId={requestId}
              onPendingChange={setPending}
              onCancel={() => handleOpenChange(false)}
              onSubmitted={() => {
                setSubmitted(true);
                setOpen(false);
              }}
            />
          </React.Suspense>
        </DialogContent>
      </Dialog>

      {submitted ? (
        <p role="status" className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground">
          {COPY.success}
        </p>
      ) : null}
    </div>
  );
}