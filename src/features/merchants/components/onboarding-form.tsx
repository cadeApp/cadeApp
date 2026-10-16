'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Store, Phone, MapPin, AlertTriangle, AlertCircle, Info, Crosshair } from 'lucide-react';
import { isWithinAguilaresBounds } from '@/domain/schemas';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Input } from '@/ui/input';
import { MapSkeleton } from '@/ui/map-skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Textarea } from '@/ui/textarea';
import { merchantOnboardingAction, updateMerchantProfileAction } from '../actions';
import { merchantCopy } from '../copy';
import {
  merchantOnboardingSchema,
  merchantEditFormSchema,
  type MerchantEditFormInput,
} from '../schemas';
import { useForm, type FieldErrors } from './form-hooks';
import type { ZoneOption } from '../queries';
import Link from 'next/link';
import { getLegalDocument } from '@/features/legal';

const MapPicker = dynamic(() => import('@/ui/map').then((mod) => mod.MapPicker), {
  ssr: false,
  loading: () => <MapSkeleton className="h-64 w-full" />,
});

export interface MerchantFormInitialData {
  readonly businessName?: string;
  readonly phone?: string;
  readonly defaultPickupZoneId?: string | null;
  readonly defaultPickupZoneName?: string | null;
  readonly defaultPickupAddress?: string;
  readonly defaultPickupLat?: number | null;
  readonly defaultPickupLng?: number | null;
  readonly notes?: string | null;
  readonly isComplete?: boolean;
}

interface MerchantOnboardingFormProps {
  readonly zones: ZoneOption[];
  readonly initialData?: MerchantFormInitialData | null;
}

export function MerchantOnboardingForm({ zones, initialData }: MerchantOnboardingFormProps) {
  const isEdit = Boolean(initialData?.isComplete);
  const [coordsError, setCoordsError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const resolver = (values: unknown) => {
    const schema = isEdit ? merchantEditFormSchema : merchantOnboardingSchema;
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data as MerchantEditFormInput, errors: {} };
    }
    const errors: FieldErrors<MerchantEditFormInput> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof MerchantEditFormInput;
      if (field && !errors[field]) {
        errors[field] = { message: issue.message };
      }
    }
    return { values: values as MerchantEditFormInput, errors };
  };

  const {
    register,
    handleSubmit,
    setValue,
    setFields,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MerchantEditFormInput>({
    resolver,
    defaultValues: {
      businessName: initialData?.businessName ?? '',
      phone: initialData?.phone ?? '',
      defaultPickupZoneId: initialData?.defaultPickupZoneId ?? null,
      defaultPickupAddress: initialData?.defaultPickupAddress ?? '',
      defaultPickupLat: initialData?.defaultPickupLat ?? null,
      defaultPickupLng: initialData?.defaultPickupLng ?? null,
      notes: initialData?.notes ?? '',
      acceptPilotTerms: isEdit ? true : false,
      pilotTermsVersion: getLegalDocument('pilot_terms').version,
    },
  });

  const defaultPickupLat = watch('defaultPickupLat');
  const defaultPickupLng = watch('defaultPickupLng');
  const selectedZoneId = watch('defaultPickupZoneId');

  const inactiveZoneId =
    initialData?.defaultPickupZoneId &&
    !zones.some((z) => z.id === initialData.defaultPickupZoneId)
      ? initialData.defaultPickupZoneId
      : null;

  const selectedZone = zones.find((z) => z.id === selectedZoneId);
  const selectedZoneCenter =
    selectedZone?.centroidLat != null && selectedZone?.centroidLng != null
      ? { lat: selectedZone.centroidLat, lng: selectedZone.centroidLng }
      : null;

  const effectiveLat = isEdit
    ? (defaultPickupLat ?? null)
    : (defaultPickupLat ?? selectedZoneCenter?.lat ?? null);
  const effectiveLng = isEdit
    ? (defaultPickupLng ?? null)
    : (defaultPickupLng ?? selectedZoneCenter?.lng ?? null);
  const hasInvalidEffectiveCoords =
    effectiveLat != null &&
    effectiveLng != null &&
    !isWithinAguilaresBounds(effectiveLat, effectiveLng);

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
          return;
        }
        setFields(
          { defaultPickupLat: latitude, defaultPickupLng: longitude },
          { shouldValidate: true }
        );
        setCoordsError(null);
      },
      () => {
        setLocating(false);
        setCoordsError(merchantCopy.onboarding.geoErrorFallback);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const onSubmit = async (data: MerchantEditFormInput) => {
    if (isEdit) {
      if (
        data.defaultPickupLat != null &&
        data.defaultPickupLng != null &&
        !isWithinAguilaresBounds(data.defaultPickupLat, data.defaultPickupLng)
      ) {
        setCoordsError(merchantCopy.onboarding.mapOutOfAguilares);
        return;
      }

      setErrorMessage(null);

      // Derivar PATCH solo de campos modificados respecto a initialData
      const patch: Record<string, unknown> = {};

      if (data.businessName !== (initialData?.businessName ?? '')) {
        patch.businessName = data.businessName;
      }
      if (data.phone !== (initialData?.phone ?? '')) {
        patch.phone = data.phone;
      }
      if (data.defaultPickupAddress !== (initialData?.defaultPickupAddress ?? '')) {
        patch.defaultPickupAddress = data.defaultPickupAddress;
      }
      const initialZone = initialData?.defaultPickupZoneId ?? null;
      const currentZone = data.defaultPickupZoneId || null;
      if (currentZone !== initialZone) {
        patch.defaultPickupZoneId = currentZone;
      }
      const initialNotes = initialData?.notes ?? null;
      const currentNotes = data.notes ? data.notes.trim() : null;
      if (currentNotes !== initialNotes) {
        patch.notes = currentNotes;
      }

      // Coordenadas: si alguna cambió respecto a initialData, enviar ambas (números o ambas null)
      const initialLat = initialData?.defaultPickupLat ?? null;
      const initialLng = initialData?.defaultPickupLng ?? null;
      const currentLat = data.defaultPickupLat ?? null;
      const currentLng = data.defaultPickupLng ?? null;
      if (currentLat !== initialLat || currentLng !== initialLng) {
        patch.defaultPickupLat = currentLat;
        patch.defaultPickupLng = currentLng;
      }

      // Si no hubo ningún cambio modificado, redirigir sin llamada
      if (Object.keys(patch).length === 0) {
        window.location.assign('/merchant/plan');
        return;
      }

      try {
        const result = await updateMerchantProfileAction(patch);

        if (!result.ok) {
          setErrorMessage(merchantCopy.onboarding.errorGeneric);
          return;
        }

        window.location.assign(result.data.redirectTo);
      } catch {
        setErrorMessage(merchantCopy.onboarding.errorGeneric);
      }
      return;
    }

    const finalLat = data.defaultPickupLat ?? selectedZoneCenter?.lat ?? null;
    const finalLng = data.defaultPickupLng ?? selectedZoneCenter?.lng ?? null;

    if (finalLat != null && finalLng != null && !isWithinAguilaresBounds(finalLat, finalLng)) {
      setCoordsError(merchantCopy.onboarding.mapOutOfAguilares);
      return;
    }

    setErrorMessage(null);

    try {
      const result = await merchantOnboardingAction({
        businessName: data.businessName,
        phone: data.phone,
        defaultPickupAddress: data.defaultPickupAddress,
        defaultPickupZoneId: data.defaultPickupZoneId || undefined,
        defaultPickupLat: finalLat,
        defaultPickupLng: finalLng,
        notes: data.notes || undefined,
        acceptPilotTerms: true,
        pilotTermsVersion: data.pilotTermsVersion ?? getLegalDocument('pilot_terms').version,
      });

      if (!result.ok) {
        setErrorMessage(merchantCopy.onboarding.errorGeneric);
        return;
      }

      window.location.assign(result.data.redirectTo);
    } catch {
      setErrorMessage(merchantCopy.onboarding.errorGeneric);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-lg space-y-6 p-6 sm:p-8">
      {/* Barra de progreso: Paso 2 de 2 (solo en onboarding) */}
      {!isEdit && (
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
      )}

      {/* Encabezado */}
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          {isEdit ? merchantCopy.edit.title : merchantCopy.onboarding.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isEdit ? merchantCopy.edit.subtitle : merchantCopy.onboarding.subtitle}
        </p>
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
              inputMode="tel"
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
          <Select
            value={selectedZoneId ?? ''}
            onValueChange={(zoneId) => {
              if (inactiveZoneId && zoneId === inactiveZoneId) {
                return;
              }
              setValue('defaultPickupZoneId', zoneId, { shouldValidate: true });
            }}
          >
            <SelectTrigger
              id="zone"
              hasError={Boolean(errors.defaultPickupZoneId)}
              aria-describedby={errors.defaultPickupZoneId ? 'zone-error' : undefined}
            >
              <SelectValue placeholder={merchantCopy.onboarding.zonePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {inactiveZoneId && (
                <SelectItem
                  key={inactiveZoneId}
                  value={inactiveZoneId}
                  disabled
                  className="opacity-60 cursor-not-allowed text-muted-foreground"
                >
                  Barrio anteriormente asignado (no disponible)
                </SelectItem>
              )}
              {zones.map((zone) => (
                <SelectItem key={zone.id} value={zone.id}>
                  {zone.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.defaultPickupZoneId && (
            <p id="zone-error" className="text-sm text-destructive">
              {errors.defaultPickupZoneId.message}
            </p>
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

        {/* Ubicación del local en el mapa / Selector interactivo T-116 */}
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

          <div className="flex flex-col sm:flex-row gap-2">
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

            {defaultPickupLat != null && defaultPickupLng != null && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => {
                  setFields(
                    { defaultPickupLat: null, defaultPickupLng: null },
                    { shouldValidate: true }
                  );
                  setCoordsError(null);
                }}
                className="w-full sm:w-auto text-muted-foreground hover:text-destructive shrink-0"
                aria-label="Quitar ubicación"
              >
                Quitar ubicación
              </Button>
            )}
          </div>

          <MapPicker
            value={
              defaultPickupLat != null && defaultPickupLng != null
                ? { lat: defaultPickupLat, lng: defaultPickupLng }
                : null
            }
            showMarkerWhenEmpty={!isEdit}
            onChange={(coords) => {
              setFields(
                { defaultPickupLat: coords.lat, defaultPickupLng: coords.lng },
                { shouldValidate: true }
              );
              setCoordsError(null);
            }}
            defaultZoneCenter={selectedZoneCenter}
          />

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

        {/* Tarjeta informativa de piloto gratis y checkbox de términos (solo en onboarding) */}
        {!isEdit && (
          <>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
              <div className="flex items-center gap-2 font-semibold text-primary-dark">
                <Info className="h-4 w-4" />
                <span>{merchantCopy.onboarding.pilotBadge}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {merchantCopy.onboarding.pilotNotice}
              </p>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <label
                htmlFor="pilotTerms"
                className="flex min-h-12 min-w-12 cursor-pointer items-center justify-center"
              >
                <input
                  id="pilotTerms"
                  type="checkbox"
                  aria-labelledby="pilot-terms-label"
                  {...register('acceptPilotTerms')}
                  className="h-5 w-5 rounded border-input text-primary focus:ring-ring"
                />
              </label>
              <p id="pilot-terms-label" className="text-sm leading-relaxed text-muted-foreground">
                {merchantCopy.onboarding.acceptTermsPrefix}{' '}
                <Link
                  href="/legal/pilot"
                  className="rounded-sm font-semibold text-primary-dark underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {merchantCopy.onboarding.pilotTermsLink}
                </Link>
                .
              </p>
            </div>
            {errors.acceptPilotTerms && (
              <p className="text-sm text-destructive">{errors.acceptPilotTerms.message}</p>
            )}
          </>
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

        {/* Botón principal (Empezar en onboarding, Guardar cambios en edición) */}
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting || hasInvalidEffectiveCoords}
          className="w-full font-semibold"
        >
          {isSubmitting
            ? isEdit
              ? merchantCopy.edit.loadingButton
              : merchantCopy.onboarding.loadingButton
            : isEdit
              ? merchantCopy.edit.submitButton
              : merchantCopy.onboarding.submitButton}
        </Button>
      </form>
    </Card>
  );
}
