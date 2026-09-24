'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  CreditCard,
  HelpCircle,
  Info,
  MapPin,
  Navigation,
  Package,
  Phone,
  User,
} from 'lucide-react';
import { isWithinAguilaresBounds } from '@/domain/schemas';
import { getDomainErrorMessage } from '@/lib/error-messages';
import { formatArs } from '@/lib/format';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { cn } from '@/ui/cn';
import { Input } from '@/ui/input';
import { notify } from '@/ui/notify';
import { Textarea } from '@/ui/textarea';
import { createDeliveryRequestAction } from '../actions';
import { requestsCopy } from '../copy';
import type { MerchantDefaultPickup, ZoneOption } from '../queries';
import {
  createDeliveryRequestSchema,
  type CreateDeliveryRequestInput,
  type CreateDeliveryRequestOutput,
} from '../schemas';

interface CreateRequestFormProps {
  readonly zones: ZoneOption[];
  readonly defaultPickup?: MerchantDefaultPickup | null;
}

export function CreateRequestForm({ zones, defaultPickup }: CreateRequestFormProps) {
  const router = useRouter();
  const copy = requestsCopy.newRequest;

  // Estados efímeros de UI
  const [pickupLocating, setPickupLocating] = React.useState(false);
  const [pickupCoordsError, setPickupCoordsError] = React.useState<string | null>(null);

  const [dropoffLocating, setDropoffLocating] = React.useState(false);
  const [dropoffCoordsError, setDropoffCoordsError] = React.useState<string | null>(null);

  const [customChangeInput, setCustomChangeInput] = React.useState('');
  const [serverError, setServerError] = React.useState<string | null>(null);

  // Formulario gobernado por react-hook-form + zodResolver
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateDeliveryRequestInput, unknown, CreateDeliveryRequestOutput>({
    resolver: zodResolver(createDeliveryRequestSchema),
    defaultValues: {
      pickupAddress: defaultPickup?.defaultPickupAddress ?? '',
      pickupZoneId: defaultPickup?.defaultPickupZoneId ?? zones[0]?.id ?? '',
      pickupLat: defaultPickup?.defaultPickupLat ?? null,
      pickupLng: defaultPickup?.defaultPickupLng ?? null,
      dropoffAddress: '',
      dropoffZoneId: zones[1]?.id ?? zones[0]?.id ?? '',
      dropoffLat: null,
      dropoffLng: null,
      recipientName: '',
      recipientPhone: '',
      recipientConsentDeclared: false as unknown as true,
      packageType: 'chico',
      recipientPaymentMethod: 'cash',
      needsChange: false,
      cashChangeAmount: null,
      notes: defaultPickup?.notes ?? '',
    },
  });

  const pickupLat = watch('pickupLat');
  const pickupLng = watch('pickupLng');
  const dropoffLat = watch('dropoffLat');
  const dropoffLng = watch('dropoffLng');
  const packageType = watch('packageType');
  const paymentMethod = watch('recipientPaymentMethod');
  const needsChange = watch('needsChange');
  const cashChangeAmount = watch('cashChangeAmount');

  // Geolocalización para retiro
  const handleUseMyLocationPickup = () => {
    if (!navigator.geolocation) {
      setPickupCoordsError('Tu dispositivo no soporta geolocalización.');
      return;
    }
    setPickupLocating(true);
    setPickupCoordsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickupLocating(false);
        const { latitude, longitude } = pos.coords;
        if (!isWithinAguilaresBounds(latitude, longitude)) {
          setPickupCoordsError(copy.mapOutOfAguilares);
          setValue('pickupLat', null, { shouldValidate: true });
          setValue('pickupLng', null, { shouldValidate: true });
          return;
        }
        setValue('pickupLat', latitude, { shouldValidate: true });
        setValue('pickupLng', longitude, { shouldValidate: true });
        setPickupCoordsError(null);
      },
      () => {
        setPickupLocating(false);
        setPickupCoordsError('No pudimos obtener la ubicación. Podés continuar con la dirección.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Geolocalización para entrega
  const handleUseMyLocationDropoff = () => {
    if (!navigator.geolocation) {
      setDropoffCoordsError('Tu dispositivo no soporta geolocalización.');
      return;
    }
    setDropoffLocating(true);
    setDropoffCoordsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDropoffLocating(false);
        const { latitude, longitude } = pos.coords;
        if (!isWithinAguilaresBounds(latitude, longitude)) {
          setDropoffCoordsError(copy.mapOutOfAguilares);
          setValue('dropoffLat', null, { shouldValidate: true });
          setValue('dropoffLng', null, { shouldValidate: true });
          return;
        }
        setValue('dropoffLat', latitude, { shouldValidate: true });
        setValue('dropoffLng', longitude, { shouldValidate: true });
        setDropoffCoordsError(null);
      },
      () => {
        setDropoffLocating(false);
        setDropoffCoordsError('No pudimos obtener la ubicación. Podés continuar con la dirección.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handlePresetChangeAmount = (amount: number) => {
    setValue('cashChangeAmount', amount, { shouldValidate: true });
    setCustomChangeInput('');
  };

  const handleCustomChangeChange = (val: string) => {
    setCustomChangeInput(val);
    const parsed = Number.parseInt(val.replace(/\D/g, ''), 10);
    setValue('cashChangeAmount', Number.isNaN(parsed) || parsed <= 0 ? null : parsed, {
      shouldValidate: true,
    });
  };

  const onSubmit = async (data: CreateDeliveryRequestOutput) => {
    setServerError(null);

    try {
      const result = await createDeliveryRequestAction(data);

      if (!result.ok) {
        const msg = getDomainErrorMessage(result.code);
        setServerError(msg);
        notify.error(msg);
        return;
      }

      notify.success('Solicitud publicada con éxito');
      router.push(result.data.redirectTo);
    } catch {
      setServerError(copy.errorGeneric);
      notify.error(copy.errorGeneric);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto w-full max-w-xl space-y-6 pb-16">
      {/* Encabezado */}
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {copy.pageTitle}
        </h1>
        <p className="text-sm text-muted-foreground">{copy.pageSubtitle}</p>
      </div>

      {serverError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {/* 1. Punto de retiro (precargado y editable) */}
      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary-dark" aria-hidden="true" />
            <h2 className="font-display text-base font-bold text-foreground">{copy.stepPickup}</h2>
          </div>
          {defaultPickup && (
            <Badge variant="outline" className="border-primary/30 text-sm font-medium text-primary">
              Precargado editable
            </Badge>
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="pickup-zone" className="block text-sm font-medium text-foreground">
              {copy.pickupZoneLabel} <span className="text-destructive">*</span>
            </label>
            <select
              id="pickup-zone"
              {...register('pickupZoneId')}
              aria-invalid={Boolean(errors.pickupZoneId)}
              className="flex h-12 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-base text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="" disabled>
                Seleccioná un barrio de retiro
              </option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
            {errors.pickupZoneId && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {errors.pickupZoneId.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="pickup-address" className="block text-sm font-medium text-foreground">
              {copy.pickupAddressLabel} <span className="text-destructive">*</span>
            </label>
            <Input
              id="pickup-address"
              {...register('pickupAddress')}
              placeholder={copy.pickupAddressPlaceholder}
              maxLength={200}
              aria-invalid={Boolean(errors.pickupAddress)}
            />
            {errors.pickupAddress && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {errors.pickupAddress.message}
              </p>
            )}
          </div>

          <div className="pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUseMyLocationPickup}
              disabled={pickupLocating}
              className="min-h-[44px] gap-2 text-sm"
            >
              <Navigation
                className={cn('h-4 w-4 text-primary', pickupLocating && 'animate-spin')}
              />
              {pickupLocating ? 'Obteniendo GPS...' : copy.useMyLocation}
            </Button>
            {pickupLat != null && pickupLng != null && !pickupCoordsError && (
              <span className="ml-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                <CheckCircle2 className="h-4 w-4" /> Pin de retiro fijado
              </span>
            )}
            {pickupCoordsError && (
              <p className="mt-2 text-sm text-destructive">{pickupCoordsError}</p>
            )}
            {errors.pickupLat && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {errors.pickupLat.message}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* 2. Destino y entrega */}
      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Navigation className="h-4 w-4 text-primary-dark" aria-hidden="true" />
          <h2 className="font-display text-base font-bold text-foreground">{copy.stepDropoff}</h2>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="dropoff-zone" className="block text-sm font-medium text-foreground">
              {copy.dropoffZoneLabel} <span className="text-destructive">*</span>
            </label>
            <select
              id="dropoff-zone"
              {...register('dropoffZoneId')}
              aria-invalid={Boolean(errors.dropoffZoneId)}
              className="flex h-12 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-base text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="" disabled>
                Seleccioná un barrio de entrega
              </option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
            {errors.dropoffZoneId && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {errors.dropoffZoneId.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="dropoff-address" className="block text-sm font-medium text-foreground">
              {copy.dropoffAddressLabel} <span className="text-destructive">*</span>
            </label>
            <Input
              id="dropoff-address"
              {...register('dropoffAddress')}
              placeholder={copy.dropoffAddressPlaceholder}
              maxLength={200}
              aria-invalid={Boolean(errors.dropoffAddress)}
            />
            {errors.dropoffAddress && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {errors.dropoffAddress.message}
              </p>
            )}
          </div>

          <div className="pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUseMyLocationDropoff}
              disabled={dropoffLocating}
              className="min-h-[44px] gap-2 text-sm"
            >
              <Navigation
                className={cn('h-4 w-4 text-primary', dropoffLocating && 'animate-spin')}
              />
              {dropoffLocating ? 'Obteniendo GPS...' : 'Fijar ubicación opcional en Aguilares'}
            </Button>
            {dropoffLat != null && dropoffLng != null && !dropoffCoordsError && (
              <span className="ml-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                <CheckCircle2 className="h-4 w-4" /> Pin de entrega fijado
              </span>
            )}
            {dropoffCoordsError && (
              <p className="mt-2 text-sm text-destructive">{dropoffCoordsError}</p>
            )}
            {errors.dropoffLat && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {errors.dropoffLat.message}
              </p>
            )}
          </div>

          {/* Datos del destinatario */}
          <div className="mt-4 border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Datos del destinatario</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="recipient-name"
                  className="block text-sm font-medium text-foreground"
                >
                  {copy.recipientNameLabel} <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="recipient-name"
                    {...register('recipientName')}
                    placeholder={copy.recipientNamePlaceholder}
                    maxLength={100}
                    aria-invalid={Boolean(errors.recipientName)}
                    className="pl-10"
                  />
                </div>
                {errors.recipientName && (
                  <p role="alert" className="text-sm font-medium text-destructive">
                    {errors.recipientName.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="recipient-phone"
                  className="block text-sm font-medium text-foreground"
                >
                  {copy.recipientPhoneLabel} <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="recipient-phone"
                    type="tel"
                    {...register('recipientPhone')}
                    placeholder={copy.recipientPhonePlaceholder}
                    maxLength={30}
                    aria-invalid={Boolean(errors.recipientPhone)}
                    className="pl-10"
                  />
                </div>
                {errors.recipientPhone && (
                  <p role="alert" className="text-sm font-medium text-destructive">
                    {errors.recipientPhone.message}
                  </p>
                )}
              </div>
            </div>

            {/* Declaración de consentimiento */}
            <div className="mt-4 flex flex-col gap-1.5">
              <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/30 p-3.5">
                <input
                  id="recipient-consent"
                  type="checkbox"
                  {...register('recipientConsentDeclared')}
                  className="mt-1 h-5 w-5 rounded border-border text-primary focus:ring-primary"
                />
                <label
                  htmlFor="recipient-consent"
                  className="cursor-pointer text-sm leading-relaxed text-foreground"
                >
                  {copy.recipientConsentLabel}
                </label>
              </div>
              {errors.recipientConsentDeclared && (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {errors.recipientConsentDeclared.message}
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Detalles del paquete */}
      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Package className="h-4 w-4 text-primary-dark" aria-hidden="true" />
          <h2 className="font-display text-base font-bold text-foreground">{copy.stepPackage}</h2>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            {copy.packageTypeLabel}
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(['sobre', 'chico', 'mediano', 'grande'] as const).map((type) => {
              const opt = copy.packageOptions[type];
              const isSelected = packageType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setValue('packageType', type, { shouldValidate: true })}
                  className={cn(
                    'flex min-h-[58px] flex-col items-start justify-center rounded-lg border p-3 text-left transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/10 font-semibold text-primary'
                      : 'border-border bg-background text-foreground hover:bg-muted/50'
                  )}
                >
                  <span className="text-sm font-bold capitalize">{opt.label}</span>
                  <span className="line-clamp-2 text-xs opacity-80">{opt.description}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* 4. Pago del envío */}
      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Banknote className="h-4 w-4 text-primary-dark" aria-hidden="true" />
          <h2 className="font-display text-base font-bold text-foreground">{copy.stepPayment}</h2>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>{copy.paymentMethodHint}</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              {copy.paymentMethodLabel}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['cash', 'transfer', 'to_agree'] as const).map((method) => {
                const isSelected = paymentMethod === method;
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => {
                      setValue('recipientPaymentMethod', method, { shouldValidate: true });
                      if (method !== 'cash') {
                        setValue('needsChange', false, { shouldValidate: true });
                        setValue('cashChangeAmount', null, { shouldValidate: true });
                        setCustomChangeInput('');
                      }
                    }}
                    className={cn(
                      'flex min-h-[48px] items-center justify-center gap-2 rounded-lg border p-3 text-sm font-semibold transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-foreground hover:bg-muted/50'
                    )}
                  >
                    {method === 'cash' && <Banknote className="h-4 w-4" />}
                    {method === 'transfer' && <CreditCard className="h-4 w-4" />}
                    {method === 'to_agree' && <HelpCircle className="h-4 w-4" />}
                    <span>{copy.paymentOptions[method]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Opciones de cambio si es efectivo */}
          {paymentMethod === 'cash' && (
            <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{copy.needsChangeLabel}</span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={needsChange ? 'default' : 'outline'}
                    onClick={() => {
                      setValue('needsChange', true, { shouldValidate: true });
                      if (!cashChangeAmount) {
                        setValue('cashChangeAmount', 2000, { shouldValidate: true });
                      }
                    }}
                    className="min-h-[44px] min-w-[60px] text-sm"
                  >
                    Sí
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={!needsChange ? 'default' : 'outline'}
                    onClick={() => {
                      setValue('needsChange', false, { shouldValidate: true });
                      setValue('cashChangeAmount', null, { shouldValidate: true });
                      setCustomChangeInput('');
                    }}
                    className="min-h-[44px] min-w-[60px] text-sm"
                  >
                    No
                  </Button>
                </div>
              </div>

              {needsChange && (
                <div className="space-y-3 pt-2">
                  <label className="block text-sm font-medium text-foreground">
                    {copy.changePresetLabel}
                  </label>
                  {/* Chips rápidos de billete */}
                  <div className="flex flex-wrap gap-2">
                    {copy.changePresets.map((preset) => {
                      const isSelected = cashChangeAmount === preset && customChangeInput === '';
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handlePresetChangeAmount(preset)}
                          className={cn(
                            'min-h-[44px] rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                              : 'border-border bg-card text-foreground hover:bg-muted'
                          )}
                        >
                          Paga con: {formatArs(preset)}
                        </button>
                      );
                    })}
                  </div>

                  {/* Input libre de cambio */}
                  <div className="pt-1">
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={customChangeInput}
                      onChange={(e) => handleCustomChangeChange(e.target.value)}
                      placeholder={copy.changeCustomPlaceholder}
                      aria-invalid={Boolean(errors.cashChangeAmount)}
                    />
                    {cashChangeAmount != null && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Monto registrado:{' '}
                        <span className="font-semibold text-foreground">
                          {formatArs(cashChangeAmount)}
                        </span>
                      </p>
                    )}
                    {errors.cashChangeAmount && (
                      <p role="alert" className="mt-1 text-sm font-medium text-destructive">
                        {errors.cashChangeAmount.message}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* 5. Indicaciones adicionales */}
      <Card className="space-y-3 p-5 sm:p-6">
        <label htmlFor="notes" className="block text-base font-semibold text-foreground">
          {copy.notesLabel}
        </label>
        <Textarea
          id="notes"
          {...register('notes')}
          placeholder={copy.notesPlaceholder}
          maxLength={500}
          aria-invalid={Boolean(errors.notes)}
          className="min-h-[96px]"
        />
        {errors.notes && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {errors.notes.message}
          </p>
        )}
      </Card>

      {/* 6. Botón de envío */}
      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        className="min-h-[52px] w-full rounded-xl text-base font-bold shadow-md"
      >
        {isSubmitting ? copy.submittingButton : copy.submitButton}
      </Button>
    </form>
  );
}
