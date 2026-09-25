'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, Phone, MapPin, Crosshair, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import { isWithinAguilaresBounds } from '@/domain/schemas';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';
import { merchantOnboardingAction } from '../actions';
import { merchantCopy } from '../copy';
import { merchantOnboardingSchema, type MerchantOnboardingInput } from '../schemas';
import { useForm, zodResolver } from './form-hooks';
import type { ZoneOption } from '../queries';
import Link from 'next/link';
import { getLegalDocument } from '@/features/legal';

interface MerchantOnboardingFormProps {
  readonly zones: ZoneOption[];
}

export function MerchantOnboardingForm({ zones }: MerchantOnboardingFormProps) {
  const router = useRouter();

  const [coordsError, setCoordsError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MerchantOnboardingInput>({
    resolver: zodResolver(merchantOnboardingSchema),
    defaultValues: {
      businessName: '',
      phone: '',
      defaultPickupZoneId: null,
      defaultPickupAddress: '',
      defaultPickupLat: null,
      defaultPickupLng: null,
      notes: '',
      acceptPilotTerms: false as unknown as true,
      pilotTermsVersion: getLegalDocument('pilot_terms').version,
    },
  });

  const defaultPickupLat = watch('defaultPickupLat');
  const defaultPickupLng = watch('defaultPickupLng');

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setCoordsError(merchantCopy.onboarding.geoNotSupported);
      return;
    }
    setLocating(true);
    setCoordsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        if (!isWithinAguilaresBounds(latitude, longitude)) {
          setCoordsError(merchantCopy.onboarding.mapOutOfAguilares);
          setValue('defaultPickupLat', null, { shouldValidate: true });
          setValue('defaultPickupLng', null, { shouldValidate: true });
          return;
        }
        setValue('defaultPickupLat', latitude, { shouldValidate: true });
        setValue('defaultPickupLng', longitude, { shouldValidate: true });
        setCoordsError(null);
      },
      () => {
        setLocating(false);
        setCoordsError(merchantCopy.onboarding.geoErrorFallback);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const onSubmit = async (data: MerchantOnboardingInput) => {
    if (
      data.defaultPickupLat != null &&
      data.defaultPickupLng != null &&
      !isWithinAguilaresBounds(data.defaultPickupLat, data.defaultPickupLng)
    ) {
      setCoordsError(merchantCopy.onboarding.mapOutOfAguilares);
      return;
    }

    setErrorMessage(null);

    try {
      const result = await merchantOnboardingAction({
        ...data,
        defaultPickupZoneId: data.defaultPickupZoneId || undefined,
        notes: data.notes || undefined,
      });

      if (!result.ok) {
        setErrorMessage(merchantCopy.onboarding.errorGeneric);
        return;
      }

      router.push(result.data.redirectTo);
      router.refresh();
    } catch {
      setErrorMessage(merchantCopy.onboarding.errorGeneric);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-lg space-y-6 p-6 sm:p-8">
      {/* Barra de progreso: Paso 2 de 2 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
          <span>{merchantCopy.onboarding.stepIndicator}</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={100}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={merchantCopy.onboarding.stepIndicator}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full w-full rounded-full bg-primary transition-all duration-300" />
        </div>
      </div>

      {/* Encabezado */}
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          {merchantCopy.onboarding.title}
        </h1>
        <p className="text-sm text-muted-foreground">{merchantCopy.onboarding.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Nombre del negocio */}
        <div className="space-y-2">
          <label htmlFor="businessName" className="text-sm font-medium text-foreground">
            {merchantCopy.onboarding.businessNameLabel}
          </label>
          <div className="relative">
            <Input
              id="businessName"
              type="text"
              {...register('businessName')}
              placeholder={merchantCopy.onboarding.businessNamePlaceholder}
              aria-invalid={Boolean(errors.businessName)}
              className="pl-10"
            />
            <Store className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
          </div>
          {errors.businessName && (
            <p className="text-sm text-destructive">{errors.businessName.message}</p>
          )}
        </div>

        {/* Teléfono de contacto */}
        <div className="space-y-2">
          <label htmlFor="phone" className="text-sm font-medium text-foreground">
            {merchantCopy.onboarding.phoneLabel}
          </label>
          <div className="relative">
            <Input
              id="phone"
              type="tel"
              {...register('phone')}
              placeholder={merchantCopy.onboarding.phonePlaceholder}
              aria-invalid={Boolean(errors.phone)}
              className="pl-10"
            />
            <Phone className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
          </div>
          {errors.phone ? (
            <p className="text-sm text-destructive">{errors.phone.message}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{merchantCopy.onboarding.phoneHelper}</p>
          )}
        </div>

        {/* Barrio de retiro habitual */}
        <div className="space-y-2">
          <label htmlFor="zone" className="text-sm font-medium text-foreground">
            {merchantCopy.onboarding.zoneLabel}
          </label>
          <select
            id="zone"
            {...register('defaultPickupZoneId', {
              setValueAs: (v: string) => (v === '' ? null : v),
            })}
            className="flex h-12 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-base text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{merchantCopy.onboarding.zonePlaceholder}</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
          {errors.defaultPickupZoneId && (
            <p className="text-sm text-destructive">{errors.defaultPickupZoneId.message}</p>
          )}
        </div>

        {/* Dirección de retiro habitual */}
        <div className="space-y-2">
          <label htmlFor="address" className="text-sm font-medium text-foreground">
            {merchantCopy.onboarding.addressLabel}
          </label>
          <div className="relative">
            <Input
              id="address"
              type="text"
              {...register('defaultPickupAddress')}
              placeholder={merchantCopy.onboarding.addressPlaceholder}
              aria-invalid={Boolean(errors.defaultPickupAddress)}
              className="pl-10"
            />
            <MapPin className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
          </div>
          {errors.defaultPickupAddress ? (
            <p className="text-sm text-destructive">{errors.defaultPickupAddress.message}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{merchantCopy.onboarding.addressHelper}</p>
          )}
        </div>

        {/* Ubicación del local en el mapa / Fallback graceful */}
        <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary-dark" />
            <div className="space-y-1">
              <span className="font-semibold text-foreground">
                {merchantCopy.onboarding.mapCardTitle}
              </span>
              <p className="text-sm text-muted-foreground">
                {merchantCopy.onboarding.mapCardHelper}
              </p>
            </div>
          </div>

          {/* Degradación elegante: aviso informativo si no carga el mapa dinámico */}
          <div className="flex items-center gap-2 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
            <Info className="h-5 w-5 shrink-0 text-primary-dark" />
            <span>{merchantCopy.onboarding.mapFallbackNotice}</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleUseMyLocation}
            disabled={locating}
            className="w-full"
          >
            <Crosshair className="h-5 w-5 text-primary-dark" />
            <span>
              {locating ? merchantCopy.onboarding.locating : merchantCopy.onboarding.useMyLocation}
            </span>
          </Button>

          {defaultPickupLat != null && defaultPickupLng != null && !coordsError && (
            <div className="rounded-lg bg-primary/10 p-2.5 text-sm text-primary-dark">
              {merchantCopy.onboarding.locationMarked} ({defaultPickupLat.toFixed(4)},{' '}
              {defaultPickupLng.toFixed(4)})
            </div>
          )}

          {coordsError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>{coordsError}</span>
            </div>
          )}
          {errors.defaultPickupLat && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>{errors.defaultPickupLat.message}</span>
            </div>
          )}
        </div>

        {/* Referencia adicional (notas) - H07: min-h-20 */}
        <div className="space-y-2">
          <label htmlFor="notes" className="text-sm font-medium text-foreground">
            {merchantCopy.onboarding.notesLabel}
          </label>
          <Textarea
            id="notes"
            rows={2}
            {...register('notes', {
              setValueAs: (v: string) => (v === '' ? null : v),
            })}
            placeholder={merchantCopy.onboarding.notesPlaceholder}
            aria-invalid={Boolean(errors.notes)}
            className="min-h-20"
          />
          {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
        </div>

        {/* Tarjeta informativa de piloto gratis */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
          <div className="flex items-center gap-2 font-semibold text-primary-dark">
            <Info className="h-4 w-4" />
            <span>{merchantCopy.onboarding.pilotBadge}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {merchantCopy.onboarding.pilotNotice}
          </p>
        </div>

        {/* Checkbox de términos del piloto (H06: contenedor min-h-12 min-w-12 para target táctil >= 48px) */}
        <div className="flex items-center space-x-2 pt-1">
          <label
            htmlFor="pilotTerms"
            className="flex min-h-12 min-w-12 cursor-pointer items-center justify-center"
          >
            <input
              id="pilotTerms"
              type="checkbox"
              {...register('acceptPilotTerms')}
              className="h-5 w-5 rounded border-input text-primary focus:ring-ring"
            />
          </label>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {merchantCopy.onboarding.acceptTermsPrefix}{' '}
            <Link
              href="/legal/pilot"
              className="rounded-sm font-semibold text-primary-dark underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {merchantCopy.onboarding.pilotTermsLink}
            </Link>{' '}
            (v{getLegalDocument('pilot_terms').version}).
          </p>
        </div>
        {errors.acceptPilotTerms && (
          <p className="text-sm text-destructive">{errors.acceptPilotTerms.message}</p>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Botón principal Empezar (H03: isSubmitting) */}
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting || Boolean(coordsError)}
          className="w-full font-semibold"
        >
          {isSubmitting
            ? merchantCopy.onboarding.loadingButton
            : merchantCopy.onboarding.submitButton}
        </Button>
      </form>
    </Card>
  );
}
