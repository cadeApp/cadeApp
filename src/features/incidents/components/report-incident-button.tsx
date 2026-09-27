'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle } from 'lucide-react';
import { INCIDENT_KINDS, type IncidentKind } from '@/domain';
import { getDomainErrorMessage } from '@/lib/error-messages';
import { Button, buttonVariants } from '@/ui/button';
import { cn } from '@/ui/cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog';
import { notify } from '@/ui/notify';
import { Textarea } from '@/ui/textarea';
import { reportIncidentAction } from '../actions';
import { INCIDENTS_COPY } from '../copy';
import { canReportIncident } from '../report-window';
import { reportIncidentFormSchema, type ReportIncidentFormInput } from '../schemas';

const COPY = INCIDENTS_COPY.report;

/** Quién puede reportar desde el viaje (D05-A). El admin nunca recibe este camino. */
export type IncidentReporterRole = 'merchant' | 'courier';

export interface ReportIncidentButtonProps {
  readonly requestId: string;
  readonly actorRole: IncidentReporterRole;
  readonly tripStatus: string;
  readonly deliveredAt: string | null;
}

function descriptionErrorMessage(type: string | undefined): string {
  if (type === 'custom') return COPY.errors.descriptionContact;
  if (type === 'too_big') return COPY.errors.descriptionLong;
  return COPY.errors.descriptionShort;
}

/**
 * C06/R07: botón «Reportar un problema» con su formulario en un Dialog. Muestra el botón según D05-A; Postgres vuelve
 * a validar actor, ventana y relato en `report_incident`.
 */
export function ReportIncidentButton({ requestId, actorRole, tripStatus, deliveredAt }: ReportIncidentButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const kindRefs = React.useRef<Partial<Record<IncidentKind, HTMLButtonElement | null>>>({});
  const ids = React.useId();

  const defaultValues = { requestId, description: '' };
  const form = useForm<ReportIncidentFormInput>({
    resolver: zodResolver(reportIncidentFormSchema),
    defaultValues,
  });
  const selectedKind = form.watch('kind');
  const { errors, isSubmitting } = form.formState;

  if (!canReportIncident({ actorRole, tripStatus, deliveredAt }, Date.now())) {
    return null;
  }

  function handleOpenChange(next: boolean) {
    if (!next && isSubmitting) return;
    setOpen(next);
    if (!next) {
      form.reset(defaultValues);
      setServerError(null);
    }
  }

  function selectKind(kind: IncidentKind) {
    form.setValue('kind', kind, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
  }

  function handleKindKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, current: IncidentKind) {
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = INCIDENT_KINDS.indexOf(current);
    const next = INCIDENT_KINDS[(index + step + INCIDENT_KINDS.length) % INCIDENT_KINDS.length] ?? current;
    selectKind(next);
    kindRefs.current[next]?.focus();
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      const result = await reportIncidentAction(values);
      if (!result.ok) {
        const message = getDomainErrorMessage(result.code);
        setServerError(message);
        notify.error(message);
        return;
      }
      setSubmitted(true);
      notify.success(COPY.success);
      setOpen(false);
      form.reset(defaultValues);
    } catch {
      setServerError(COPY.errors.connection);
      notify.error(COPY.errors.connection);
    }
  });

  const kindLabelId = `${ids}-kind-label`;
  const kindErrorId = `${ids}-kind-error`;
  const descriptionId = `${ids}-description`;
  const descriptionHelpId = `${ids}-description-help`;
  const descriptionErrorId = `${ids}-description-error`;
  const focusableKind = selectedKind ?? INCIDENT_KINDS[0];

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}>
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          {COPY.trigger}
        </DialogTrigger>
        <DialogContent preventCloseOnEscape={isSubmitting}>
          <DialogHeader>
            <DialogTitle>{COPY.title}</DialogTitle>
            <DialogDescription>{COPY.description}</DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="mt-4 space-y-5" noValidate>
            <fieldset className="space-y-2" disabled={isSubmitting}>
              <p id={kindLabelId} className="text-sm font-semibold text-foreground">
                {COPY.kindLabel}
              </p>
              <div
                role="radiogroup"
                aria-labelledby={kindLabelId}
                aria-describedby={errors.kind ? kindErrorId : undefined}
                aria-invalid={errors.kind ? true : undefined}
                className="grid grid-cols-1 gap-2 sm:grid-cols-2"
              >
                {INCIDENT_KINDS.map((kind) => {
                  const checked = selectedKind === kind;
                  return (
                    <Button
                      key={kind}
                      ref={(node) => {
                        kindRefs.current[kind] = node;
                      }}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      tabIndex={kind === focusableKind ? 0 : -1}
                      variant={checked ? 'default' : 'outline'}
                      size="sm"
                      className="w-full"
                      onClick={() => selectKind(kind)}
                      onKeyDown={(event) => handleKindKeyDown(event, kind)}
                    >
                      {INCIDENTS_COPY.kinds[kind]}
                    </Button>
                  );
                })}
              </div>
              {errors.kind ? (
                <p id={kindErrorId} role="alert" className="text-sm font-medium text-destructive">
                  {COPY.errors.kind}
                </p>
              ) : null}
            </fieldset>

            <div className="space-y-2">
              <label htmlFor={descriptionId} className="block text-sm font-semibold text-foreground">
                {COPY.descriptionLabel}
              </label>
              <p id={descriptionHelpId} className="text-sm text-muted-foreground">
                {COPY.descriptionHelp}
              </p>
              <Textarea
                id={descriptionId}
                rows={4}
                maxLength={1000}
                disabled={isSubmitting}
                aria-invalid={errors.description ? true : undefined}
                aria-describedby={
                  errors.description ? `${descriptionHelpId} ${descriptionErrorId}` : descriptionHelpId
                }
                {...form.register('description')}
              />
              {errors.description ? (
                <p id={descriptionErrorId} role="alert" className="text-sm font-medium text-destructive">
                  {descriptionErrorMessage(errors.description.type)}
                </p>
              ) : null}
            </div>

            {serverError ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {serverError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => handleOpenChange(false)}
              >
                {COPY.cancel}
              </Button>
              <Button type="submit" isPending={isSubmitting} pendingText={COPY.submitting}>
                {COPY.submit}
              </Button>
            </DialogFooter>
          </form>
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
