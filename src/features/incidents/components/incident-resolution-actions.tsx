'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { IncidentDecision } from '@/domain';
import { getDomainErrorMessage } from '@/lib/error-messages';
import { Button, buttonVariants, type ButtonProps } from '@/ui/button';
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
import { resolveIncidentAction } from '../actions';
import { INCIDENTS_COPY } from '../copy';
import { resolveIncidentFormSchema, type ResolveIncidentFormInput } from '../schemas';

const COPY = INCIDENTS_COPY.resolve;

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

function ResolutionDialog({
  incidentId,
  decision,
}: {
  readonly incidentId: string;
  readonly decision: IncidentDecision;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const ids = React.useId();

  const form = useForm<ResolveIncidentFormInput>({
    resolver: zodResolver(resolveIncidentFormSchema),
    defaultValues: { reason: '' },
  });
  const { errors, isSubmitting } = form.formState;

  function handleOpenChange(next: boolean) {
    if (!next && isSubmitting) return;
    setOpen(next);
    if (!next) {
      form.reset({ reason: '' });
      setServerError(null);
    }
  }

  const onSubmit = form.handleSubmit(async ({ reason }) => {
    setServerError(null);
    try {
      const result = await resolveIncidentAction({ incidentId, decision, reason });
      if (!result.ok) {
        const message = getDomainErrorMessage(result.code);
        setServerError(message);
        notify.error(message);
        return;
      }
      notify.success(COPY.success[decision]);
      setOpen(false);
      form.reset({ reason: '' });
      router.refresh();
    } catch {
      setServerError(COPY.connection);
      notify.error(COPY.connection);
    }
  });

  const reasonId = `${ids}-reason`;
  const reasonHelpId = `${ids}-reason-help`;
  const reasonErrorId = `${ids}-reason-error`;
  const isSuspension = decision === 'preventive_suspension';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className={cn(buttonVariants({ variant: TRIGGER_VARIANT[decision] }), 'w-full')}>
        {COPY.actions[decision]}
      </DialogTrigger>
      <DialogContent preventCloseOnEscape={isSubmitting}>
        <DialogHeader>
          <DialogTitle>{COPY.titles[decision]}</DialogTitle>
          <DialogDescription>{COPY.descriptions[decision]}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
          <div className="space-y-2">
            <label htmlFor={reasonId} className="block text-sm font-semibold text-foreground">
              {COPY.reasonLabel}
            </label>
            <p id={reasonHelpId} className="text-sm text-muted-foreground">
              {COPY.reasonHelp}
            </p>
            <Textarea
              id={reasonId}
              rows={3}
              maxLength={500}
              placeholder={COPY.reasonPlaceholder}
              disabled={isSubmitting}
              aria-invalid={errors.reason ? true : undefined}
              aria-describedby={errors.reason ? `${reasonHelpId} ${reasonErrorId}` : reasonHelpId}
              {...form.register('reason')}
            />
            {errors.reason ? (
              <p id={reasonErrorId} role="alert" className="text-sm font-medium text-destructive">
                {errors.reason.type === 'too_big' ? COPY.reasonTooLong : COPY.reasonRequired}
              </p>
            ) : null}
          </div>

          {serverError ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {serverError}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => handleOpenChange(false)}>
              {COPY.cancel}
            </Button>
            <Button
              type="submit"
              variant={isSuspension ? 'destructive' : 'default'}
              isPending={isSubmitting}
              pendingText={COPY.processing}
            >
              {COPY.confirm[decision]}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
