'use client';

import * as React from 'react';
import type { IncidentDecision } from '@/domain';
import { buttonVariants, type ButtonProps } from '@/ui/button';
import { cn } from '@/ui/cn';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/dialog';
import { Skeleton } from '@/ui/skeleton';
import { INCIDENTS_COPY } from '../copy';

const COPY = INCIDENTS_COPY.resolve;

// El formulario del motivo se descarga al abrir el Dialog, igual que el de reporte: así el barrel de la feature no suma
// react-hook-form ni Zod a la carga inicial de otras rutas.
const IncidentResolutionForm = React.lazy(() =>
  import('./incident-resolution-form').then((module) => ({ default: module.IncidentResolutionForm }))
);

const TRIGGER_VARIANT: Record<IncidentDecision, NonNullable<ButtonProps['variant']>> = {
  no_action: 'default',
  warning: 'outline',
  preventive_suspension: 'destructive',
};

export interface IncidentResolutionActionsProps {
  readonly incidentId: string;
  /** Solo si el viaje tiene repartidor aceptado y todavía no está suspendido; Postgres lo vuelve a validar. */
  readonly canSuspend: boolean;
}

/**
 * A05: acciones de resolución de un incidente abierto. Cada una pide confirmación y motivo en un Dialog y llama a
 * `resolveIncidentAction({ incidentId, decision, reason })`; nunca elige al repartidor afectado.
 */
export function IncidentResolutionActions({ incidentId, canSuspend }: IncidentResolutionActionsProps) {
  const decisions: IncidentDecision[] = canSuspend
    ? ['no_action', 'warning', 'preventive_suspension']
    : ['no_action', 'warning'];

  return (
    <div className="flex flex-col gap-3">
      {decisions.map((decision) => (
        <ResolutionDialog key={decision} incidentId={incidentId} decision={decision} />
      ))}
    </div>
  );
}

function ResolutionFormSkeleton() {
  return (
    <div role="status" aria-busy="true" className="mt-4 space-y-3">
      <span className="sr-only">{COPY.loading}</span>
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

function ResolutionDialog({
  incidentId,
  decision,
}: {
  readonly incidentId: string;
  readonly decision: IncidentDecision;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  function handleOpenChange(next: boolean) {
    if (!next && pending) return;
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className={cn(buttonVariants({ variant: TRIGGER_VARIANT[decision] }), 'w-full')}>
        {COPY.actions[decision]}
      </DialogTrigger>
      <DialogContent preventCloseOnEscape={pending} className="max-h-full overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{COPY.titles[decision]}</DialogTitle>
          <DialogDescription>{COPY.descriptions[decision]}</DialogDescription>
        </DialogHeader>
        <React.Suspense fallback={<ResolutionFormSkeleton />}>
          <IncidentResolutionForm
            incidentId={incidentId}
            decision={decision}
            onPendingChange={setPending}
            onCancel={() => handleOpenChange(false)}
            onResolved={() => setOpen(false)}
          />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
}
