'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { INCIDENT_KINDS, type IncidentKind } from '@/domain';
import { getDomainErrorMessage } from '@/lib/error-messages';
import { Button } from '@/ui/button';
import { DialogFooter } from '@/ui/dialog';
import { notify } from '@/ui/notify';
import { Textarea } from '@/ui/textarea';
import { reportIncidentAction } from '../actions';
import { INCIDENTS_COPY } from '../copy';
import { reportIncidentFormSchema, type ReportIncidentFormInput } from '../schemas';

const COPY = INCIDENTS_COPY.report;

function descriptionErrorMessage(type: string | undefined): string {
  if (type === 'custom') return COPY.errors.descriptionContact;
  if (type === 'too_big') return COPY.errors.descriptionLong;
  return COPY.errors.descriptionShort;
}

export interface ReportIncidentFormProps {
  readonly requestId: string;
  readonly onPendingChange: (pending: boolean) => void;
  readonly onCancel: () => void;
  readonly onSubmitted: () => void;
}

/**
 * C06/R07: formulario del reporte (tipo canónico + relato sin contacto). Se carga recién al abrir el Dialog para que
 * react-hook-form, Zod y los contratos no pesen en la carga inicial del viaje.
 */
export function ReportIncidentForm({ requestId, onPendingChange, onCancel, onSubmitted }: ReportIncidentFormProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const kindRefs = React.useRef<Partial<Record<IncidentKind, HTMLButtonElement | null>>>({});
  const ids = React.useId();

  const form = useForm<ReportIncidentFormInput>({
    resolver: zodResolver(reportIncidentFormSchema),
    defaultValues: { requestId, description: '' },
  });
  const selectedKind = form.watch('kind');
  const { errors, isSubmitting } = form.formState;

  React.useEffect(() => {
    onPendingChange(isSubmitting);
  }, [isSubmitting, onPendingChange]);

  function selectKind(kind: IncidentKind) {
    form.setValue('kind', kind, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
  }

  function handleKindKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, current: IncidentKind) {
    const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';
    const backward = event.key === 'ArrowUp' || event.key === 'ArrowLeft';
    const step = forward ? 1 : backward ? -1 : 0;
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
      notify.success(COPY.success);
      onPendingChange(false);
      onSubmitted();
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
  const safetyNoticeId = `${ids}-safety-notice`;
  const focusableKind = selectedKind ?? INCIDENT_KINDS[0];

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-5" noValidate>
      <fieldset className="space-y-2" disabled={isSubmitting}>
        <p id={kindLabelId} className="text-sm font-semibold text-foreground">
          {COPY.kindLabel}
        </p>
        <div
          role="radiogroup"
          aria-labelledby={kindLabelId}
          aria-describedby={
            [errors.kind ? kindErrorId : null, selectedKind === 'safety' ? safetyNoticeId : null]
              .filter(Boolean)
              .join(' ') || undefined
          }
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
        <div aria-live="polite">
          {selectedKind === 'safety' ? (
            <p
              id={safetyNoticeId}
              className="rounded-lg border border-destructive p-3 text-sm font-semibold text-foreground"
            >
              {COPY.safetyNotice}
            </p>
          ) : null}
        </div>
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
          aria-describedby={errors.description ? `${descriptionHelpId} ${descriptionErrorId}` : descriptionHelpId}
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
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>
          {COPY.cancel}
        </Button>
        <Button type="submit" isPending={isSubmitting} pendingText={COPY.submitting}>
          {COPY.submit}
        </Button>
      </DialogFooter>
    </form>
  );
}
