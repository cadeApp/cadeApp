'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Input } from '@/ui/input';
import { notify } from '@/ui/notify';
import { cn } from '@/ui/cn';
import { getDomainErrorMessage } from '@/lib/error-messages';
import type { PlatformSettingKey } from '@/domain';
import { updatePlatformSettingAction } from '../actions';
import { ADMIN_COPY } from '../copy';
import {
  graceDaysFormSchema,
  minOfferFormSchema,
  requestTtlFormSchema,
  termsVersionFormSchema,
  type UpdatePlatformSettingInput,
} from '../schemas';
import type { PlatformSettingsSnapshot } from '../types';

const COPY = ADMIN_COPY.settings;

interface ValueFormInput {
  value: string;
}

type ValueFormSchema = z.ZodType<ValueFormInput, z.ZodTypeDef, ValueFormInput>;

/**
 * Guarda un parámetro vía la Server Action y devuelve el mensaje de error visible, o null si salió bien.
 */
function useSaveSetting() {
  const router = useRouter();

  return React.useCallback(
    async (input: UpdatePlatformSettingInput): Promise<string | null> => {
      try {
        const res = await updatePlatformSettingAction(input);
        if (!res.ok) {
          const message = getDomainErrorMessage(res.code);
          notify.error(message);
          return message;
        }
        notify.success(COPY.success);
        router.refresh();
        return null;
      } catch {
        notify.error(COPY.connectionError);
        return COPY.connectionError;
      }
    },
    [router]
  );
}

export interface PlatformSettingsFormProps {
  readonly settings: PlatformSettingsSnapshot;
}

/**
 * A04: los cinco parámetros de `platform_settings`, cada uno con su propio guardado auditado.
 */
export function PlatformSettingsForm({ settings }: PlatformSettingsFormProps) {
  return (
    <div className="space-y-4">
      <Card className="border border-border bg-muted/70 p-4 shadow-none">
        <p className="text-sm font-semibold text-foreground">{COPY.warningTitle}</p>
        <p className="text-sm text-muted-foreground">{COPY.warning}</p>
      </Card>

      <ValueSettingRow
        settingKey="min_offer_ars"
        schema={minOfferFormSchema}
        initialValue={String(settings.minOfferArs)}
        toInput={(value) => ({ key: 'min_offer_ars', value: Number(value) })}
      />
      <ValueSettingRow
        settingKey="request_ttl_minutes"
        schema={requestTtlFormSchema}
        initialValue={String(settings.requestTtlMinutes)}
        toInput={(value) => ({ key: 'request_ttl_minutes', value: Number(value) })}
      />
      <PilotActiveRow initialValue={settings.pilotActive} />
      <ValueSettingRow
        settingKey="subscription_grace_days"
        schema={graceDaysFormSchema}
        initialValue={String(settings.subscriptionGraceDays)}
        toInput={(value) => ({ key: 'subscription_grace_days', value: Number(value) })}
      />
      <ValueSettingRow
        settingKey="pilot_terms_version"
        schema={termsVersionFormSchema}
        initialValue={settings.pilotTermsVersion}
        toInput={(value) => ({ key: 'pilot_terms_version', value: value.trim() })}
      />
    </div>
  );
}

interface SettingRowShellProps {
  readonly settingKey: PlatformSettingKey;
  readonly controlId: string;
  readonly labelAsText?: boolean;
  readonly error: string | null;
  readonly isSubmitting: boolean;
  readonly onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  readonly children: React.ReactNode;
}

function SettingRowShell({
  settingKey,
  controlId,
  labelAsText = false,
  error,
  isSubmitting,
  onSubmit,
  children,
}: SettingRowShellProps) {
  const field = COPY.fields[settingKey];
  const helpId = `${controlId}-help`;

  return (
    <Card className="border border-border p-4 shadow-sm">
      <form onSubmit={onSubmit} noValidate className="space-y-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            {labelAsText ? (
              <p className="text-sm font-semibold text-foreground">{field.label}</p>
            ) : (
              <label htmlFor={controlId} className="block text-sm font-semibold text-foreground">
                {field.label}
              </label>
            )}
            <p id={helpId} className="text-sm text-muted-foreground">
              {field.help}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {children}
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? COPY.saving : COPY.save}
              <span className="sr-only"> {field.label}</span>
            </Button>
          </div>
        </div>
        {error ? (
          <p className="text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Card>
  );
}

interface ValueSettingRowProps {
  readonly settingKey: Exclude<PlatformSettingKey, 'pilot_active'>;
  readonly schema: ValueFormSchema;
  readonly initialValue: string;
  readonly toInput: (value: string) => UpdatePlatformSettingInput;
}

function ValueSettingRow({ settingKey, schema, initialValue, toInput }: ValueSettingRowProps) {
  const saveSetting = useSaveSetting();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const controlId = `setting-${settingKey}`;
  const field = COPY.fields[settingKey];
  const isText = settingKey === 'pilot_terms_version';

  const form = useForm<ValueFormInput>({
    resolver: zodResolver(schema),
    defaultValues: { value: initialValue },
  });

  const onSubmit = form.handleSubmit(async ({ value }) => {
    setServerError(null);
    setServerError(await saveSetting(toInput(value)));
  });

  const validationError = form.formState.errors.value?.message ?? null;
  const unitId = `${controlId}-unit`;
  const describedBy = field.unitLabel ? `${controlId}-help ${unitId}` : `${controlId}-help`;

  return (
    <SettingRowShell
      settingKey={settingKey}
      controlId={controlId}
      error={validationError ?? serverError}
      isSubmitting={form.formState.isSubmitting}
      onSubmit={onSubmit}
    >
      <div className="flex items-center gap-2">
        {field.unit && settingKey === 'min_offer_ars' ? (
          <span className="text-sm font-semibold text-muted-foreground" aria-hidden="true">
            {field.unit}
          </span>
        ) : null}
        <Input
          id={controlId}
          type="text"
          inputMode={isText ? 'text' : 'numeric'}
          autoComplete="off"
          aria-describedby={describedBy}
          aria-invalid={Boolean(validationError)}
          className={cn('w-32', isText ? 'text-left' : 'text-right tabular-nums')}
          {...form.register('value')}
        />
        {field.unit && settingKey !== 'min_offer_ars' ? (
          <span className="text-sm text-muted-foreground" aria-hidden="true">
            {field.unit}
          </span>
        ) : null}
        {field.unitLabel ? (
          <span id={unitId} className="sr-only">
            {field.unitLabel}
          </span>
        ) : null}
      </div>
    </SettingRowShell>
  );
}

function PilotActiveRow({ initialValue }: { readonly initialValue: boolean }) {
  const saveSetting = useSaveSetting();
  const [checked, setChecked] = React.useState(initialValue);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const controlId = 'setting-pilot_active';

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setServerError(null);
    setServerError(await saveSetting({ key: 'pilot_active', value: checked }));
    setIsSubmitting(false);
  }

  return (
    <SettingRowShell
      settingKey="pilot_active"
      controlId={controlId}
      labelAsText
      error={serverError}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
    >
      <div className="flex items-center gap-3">
        <Button
          id={controlId}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={COPY.fields.pilot_active.label}
          aria-describedby={`${controlId}-help`}
          variant={checked ? 'default' : 'outline'}
          size="sm"
          onClick={() => setChecked((value) => !value)}
          className="min-w-32"
        >
          {checked ? COPY.pilotOn : COPY.pilotOff}
        </Button>
      </div>
    </SettingRowShell>
  );
}
