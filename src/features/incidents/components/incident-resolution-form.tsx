'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { IncidentDecision } from '@/domain';
import { getDomainErrorMessage } from '@/lib/error-messages';
import { Button } from '@/ui/button';
import { DialogFooter } from '@/ui/dialog';
import { notify } from '@/ui/notify';
import { Textarea } from '@/ui/textarea';
import { resolveIncidentAction } from '../actions';
import { INCIDENTS_COPY } from '../copy';
import { resolveIncidentFormSchema, type ResolveIncidentFormInput } from '../schemas';

const COPY = INCIDENTS_COPY.resolve;

export interface IncidentResolutionFormProps {
  readonly incidentId: string;
  readonly decision: IncidentDecision;
  readonly onPendingChange: (pending: boolean) => void;
  readonly onCancel: () => void;
  readonly onResolved: () => void;
}

/**
 * A05: motivo obligatorio de una resolución. Envía `{ incidentId, decision, reason }` a `resolveIncidentAction`; el
 * repartidor afectado por `preventive_suspension` lo decide Postgres.
 */
export function IncidentResolutionForm({
  incidentId,
  decision,
  onPendingChange,
  onCancel,
  onResolved,
}: IncidentResolutionFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const ids = React.useId();

  const form = useForm<ResolveIncidentFormInput>({
    resolver: zodResolver(resolveIncidentFormSchema),
    defaultValues: { reason: '' },
  });
  const { errors, isSubmitting } = form.formState;

  React.useEffect(() => {
    onPendingChange(isSubmitting);
  }, [isSubmitting, onPendingChange]);

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
      onPendingChange(false);
      onResolved();
      router.refresh();
    } catch {
      setServerError(COPY.connection);
      notify.error(COPY.connection);
    }
  });

  const reasonId = `${ids}-reason`;
  const reasonHelpId = `${ids}-reason-help`;
  const reasonErrorId = `${ids}-reason-error`;

  return (
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
          // El formulario llega después de que Radix enfocó el Dialog: el foco pasa al motivo al montarse.
          autoFocus
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
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
          {COPY.cancel}
        </Button>
        <Button
          type="submit"
          variant={decision === 'preventive_suspension' ? 'destructive' : 'default'}
          isPending={isSubmitting}
          pendingText={COPY.processing}
        >
          {COPY.confirm[decision]}
        </Button>
      </DialogFooter>
    </form>
  );
}
