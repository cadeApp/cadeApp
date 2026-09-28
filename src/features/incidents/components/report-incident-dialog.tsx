'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Skeleton } from '@/ui/skeleton';
import { INCIDENTS_COPY } from '../copy';

const COPY = INCIDENTS_COPY.report;

// React Hook Form, Zod y los contratos llegan en un segundo chunk: el Dialog se abre con el Skeleton mientras tanto.
const ReportIncidentForm = React.lazy(() =>
  import('./report-incident-form').then((module) => ({ default: module.ReportIncidentForm }))
);

export interface ReportIncidentDialogProps {
  readonly requestId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
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
 * C06/R07: Dialog del reporte y confirmación posterior. Se descarga recién cuando la persona toca «Reportar un problema»
 * (ver `ReportIncidentButton`); mientras envía, no se puede cerrar.
 */
export function ReportIncidentDialog({ requestId, open, onOpenChange }: ReportIncidentDialogProps) {
  const [pending, setPending] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  function handleOpenChange(next: boolean) {
    if (!next && pending) return;
    onOpenChange(next);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
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
                onOpenChange(false);
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
    </>
  );
}
