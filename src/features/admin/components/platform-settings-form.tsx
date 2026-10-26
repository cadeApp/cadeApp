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
import { updatePlatformSettingAction } from '../actions';
import { ADMIN_COPY } from '../copy';
import {
  dropsPerCreditFormSchema,
  graceDaysFormSchema,
  maxDropsFormSchema,
  minOfferFormSchema,
  percentFormSchema,
  referencePriceFormSchema,
  requestTtlFormSchema,
  termsVersionFormSchema,
  type UpdatePlatformSettingInput,
} from '../schemas';
import type { PlatformSettingsSnapshot } from '../types';

const COPY = ADMIN_COPY.settings;

// Claves que edita este formulario, incluidas las de créditos de CC-029 (T-369).
type SettingsFormKey = keyof typeof COPY.fields;

/** Claves con el símbolo de moneda antes del valor. */
const CURRENCY_PREFIX_KEYS: ReadonlySet<SettingsFormKey> = new Set([
  'min_offer_ars',
  'loose_credit_reference_price_ars',
]);

interface ValueFormInput {
  value: string;
}

type ValueFormSchema = z.ZodType<ValueFormInput, ValueFormInput>;

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
 * A04: parámetros de `platform_settings`, cada uno con su propio guardado auditado. CC-029 suma los de créditos,
 * arrastre y descuento; los rangos los vuelve a validar `admin_update_setting`.
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
      <ValueSettingRow
        settingKey="max_drops_per_request"
        schema={maxDropsFormSchema}
        initialValue={String(settings.maxDropsPerRequest)}
        toInput={(value) => ({ key: 'max_drops_per_request', value: Number(value) })}
      />

      <section aria-labelledby="settings-credits-title" className="space-y-4 pt-2">
        <div>
          <h2 id="settings-credits-title" className="text-lg font-bold text-foreground">
            {COPY.creditsSectionTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{COPY.creditsSectionDescription}</p>
        </div>
        <ValueSettingRow
          settingKey="publication_drops_per_credit"
          schema={dropsPerCreditFormSchema}
          initialValue={String(settings.publicationDropsPerCredit)}
          toInput={(value) => ({ key: 'publication_drops_per_credit', value: Number(value) })}
        />
        <ValueSettingRow
          settingKey="carryover_base_pct"
          schema={percentFormSchema}
          initialValue={String(settings.carryoverBasePct)}
          toInput={(value) => ({ key: 'carryover_base_pct', value: Number(value) })}
        />
        <ValueSettingRow
          settingKey="carryover_step_pct"
          schema={percentFormSchema}
          initialValue={String(settings.carryoverStepPct)}
          toInput={(value) => ({ key: 'carryover_step_pct', value: Number(value) })}
        />
        <ValueSettingRow
          settingKey="carryover_cap_pct"
          schema={percentFormSchema}
          initialValue={String(settings.carryoverCapPct)}
          toInput={(value) => ({ key: 'carryover_cap_pct', value: Number(value) })}
        />
        <ValueSettingRow
          settingKey="launch_discount_pct"
          schema={percentFormSchema}
          initialValue={String(settings.launchDiscountPct)}
          toInput={(value) => ({ key: 'launch_discount_pct', value: Number(value) })}
        />
        <ValueSettingRow
          settingKey="loose_credit_reference_price_ars"
          schema={referencePriceFormSchema}
          initialValue={
            settings.looseCreditReferencePriceArs === null ? '' : String(settings.looseCreditReferencePriceArs)
          }
          placeholder={settings.looseCreditReferencePriceArs === null ? COPY.unsetValue : undefined}
          toInput={(value) => ({ key: 'loose_credit_reference_price_ars', value: Number(value) })}
        />
      </section>
    </div>
  );
}

interface SettingRowShellProps {
  readonly settingKey: SettingsFormKey;
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
  readonly settingKey: Exclude<SettingsFormKey, 'pilot_active'>;
  readonly schema: ValueFormSchema;
  readonly initialValue: string;
  readonly placeholder?: string;
  readonly toInput: (value: string) => UpdatePlatformSettingInput;
}

function ValueSettingRow({ settingKey, schema, initialValue, placeholder, toInput }: ValueSettingRowProps) {
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
        {field.unit && CURRENCY_PREFIX_KEYS.has(settingKey) ? (
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
          placeholder={placeholder}
          className={cn('w-32', isText ? 'text-left' : 'text-right tabular-nums')}
          {...form.register('value')}
        />
        {field.unit && !CURRENCY_PREFIX_KEYS.has(settingKey) ? (
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
