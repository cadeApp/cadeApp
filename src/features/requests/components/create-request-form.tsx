'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
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
import { cn } from '@/ui/cn';
import { Input } from '@/ui/input';
import { notify } from '@/ui/notify';
import { Textarea } from '@/ui/textarea';
import { createDeliveryRequestAction } from '../actions';
import { requestsCopy } from '../copy';
import type { MerchantDefaultPickup, ZoneOption } from '../queries';

interface CreateRequestFormProps {
  readonly zones: ZoneOption[];
  readonly defaultPickup?: MerchantDefaultPickup | null;
}

export function CreateRequestForm({ zones, defaultPickup }: CreateRequestFormProps) {
  const router = useRouter();
  const copy = requestsCopy.newRequest;

  // Punto de retiro (precargado y editable)
  const [pickupAddress, setPickupAddress] = React.useState(
    defaultPickup?.defaultPickupAddress ?? ''
  );
  const [pickupZoneId, setPickupZoneId] = React.useState(
    defaultPickup?.defaultPickupZoneId ?? zones[0]?.id ?? ''
  );
  const [pickupLat, setPickupLat] = React.useState<number | null>(
    defaultPickup?.defaultPickupLat ?? null
  );
  const [pickupLng, setPickupLng] = React.useState<number | null>(
    defaultPickup?.defaultPickupLng ?? null
  );
  const [pickupLocating, setPickupLocating] = React.useState(false);
  const [pickupCoordsError, setPickupCoordsError] = React.useState<string | null>(null);

  // Destino y entrega
  const [dropoffAddress, setDropoffAddress] = React.useState('');
  const [dropoffZoneId, setDropoffZoneId] = React.useState(zones[1]?.id ?? zones[0]?.id ?? '');
  const [dropoffLat, setDropoffLat] = React.useState<number | null>(null);
  const [dropoffLng, setDropoffLng] = React.useState<number | null>(null);
  const [dropoffLocating, setDropoffLocating] = React.useState(false);
  const [dropoffCoordsError, setDropoffCoordsError] = React.useState<string | null>(null);

  // Destinatario
  const [recipientName, setRecipientName] = React.useState('');
  const [recipientPhone, setRecipientPhone] = React.useState('');
  const [recipientConsentDeclared, setRecipientConsentDeclared] = React.useState(false);

  // Paquete
  const [packageType, setPackageType] = React.useState<'sobre' | 'chico' | 'mediano' | 'grande'>(
    'chico'
  );

  // Medio de pago del destinatario
  const [paymentMethod, setPaymentMethod] = React.useState<'cash' | 'transfer' | 'to_agree'>(
    'cash'
  );
  const [needsChange, setNeedsChange] = React.useState(false);
  const [cashChangeAmount, setCashChangeAmount] = React.useState<number | null>(null);
  const [customChangeInput, setCustomChangeInput] = React.useState('');

  // Notas / Indicaciones
  const [notes, setNotes] = React.useState(defaultPickup?.notes ?? '');

  // Estado general de envío
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isPending, setIsPending] = React.useState(false);

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
          setPickupLat(null);
          setPickupLng(null);
          return;
        }
        setPickupLat(latitude);
        setPickupLng(longitude);
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
          setDropoffLat(null);
          setDropoffLng(null);
          return;
        }
        setDropoffLat(latitude);
        setDropoffLng(longitude);
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
    setCashChangeAmount(amount);
    setCustomChangeInput('');
  };

  const handleCustomChangeChange = (val: string) => {
    setCustomChangeInput(val);
    const parsed = Number.parseInt(val.replace(/\D/g, ''), 10);
    setCashChangeAmount(Number.isNaN(parsed) || parsed <= 0 ? null : parsed);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    if (!recipientConsentDeclared) {
      setFormError('Debés declarar que contás con la autorización del destinatario.');
      return;
    }

    if (paymentMethod === 'cash' && needsChange && (!cashChangeAmount || cashChangeAmount <= 0)) {
      setFormError(
        'Ingresá o seleccioná con cuánto dinero en efectivo va a pagar el destinatario.'
      );
      return;
    }

    setIsPending(true);

    try {
      const result = await createDeliveryRequestAction({
        pickupZoneId,
        pickupAddress,
        pickupLat: pickupLat ?? null,
        pickupLng: pickupLng ?? null,
        dropoffZoneId,
        dropoffAddress,
        dropoffLat: dropoffLat ?? null,
        dropoffLng: dropoffLng ?? null,
        recipientName,
        recipientPhone,
        recipientConsentDeclared: true,
        packageType,
        recipientPaymentMethod: paymentMethod,
        needsChange,
        cashChangeAmount: paymentMethod === 'cash' && needsChange ? cashChangeAmount : null,
        notes: notes || undefined,
      });

      if (!result.ok) {
        const msg = getDomainErrorMessage(result.code);
        setFormError(msg);
        notify.error(msg);
        setIsPending(false);
        return;
      }

      notify.success('Solicitud publicada con éxito');
      router.push(result.data.redirectTo);
    } catch {
      setFormError(copy.errorGeneric);
      notify.error(copy.errorGeneric);
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-xl space-y-6 pb-16">
      {/* Encabezado */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {copy.pageTitle}
        </h1>
        <p className="text-sm text-muted-foreground">{copy.pageSubtitle}</p>
      </div>

      {formError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* 1. Punto de retiro (precargado y editable) */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MapPin className="h-4 w-4" />
            </div>
            <h2 className="text-base font-semibold text-foreground">{copy.stepPickup}</h2>
          </div>
          {defaultPickup && (
            <Badge variant="outline" className="border-primary/30 text-xs font-medium text-primary">
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
              value={pickupZoneId}
              onChange={(e) => setPickupZoneId(e.target.value)}
              required
              className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          </div>

          <div className="space-y-1.5">
            <label htmlFor="pickup-address" className="block text-sm font-medium text-foreground">
              {copy.pickupAddressLabel} <span className="text-destructive">*</span>
            </label>
            <Input
              id="pickup-address"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              placeholder={copy.pickupAddressPlaceholder}
              required
              maxLength={200}
              className="h-12 text-sm"
            />
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
              <span className="text-success ml-3 inline-flex items-center gap-1 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" /> Pin de retiro fijado
              </span>
            )}
            {pickupCoordsError && (
              <p className="mt-2 text-sm text-destructive">{pickupCoordsError}</p>
            )}
          </div>
        </div>
      </section>

      {/* 2. Destino y entrega */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Navigation className="h-4 w-4" />
          </div>
          <h2 className="text-base font-semibold text-foreground">{copy.stepDropoff}</h2>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="dropoff-zone" className="block text-sm font-medium text-foreground">
              {copy.dropoffZoneLabel} <span className="text-destructive">*</span>
            </label>
            <select
              id="dropoff-zone"
              value={dropoffZoneId}
              onChange={(e) => setDropoffZoneId(e.target.value)}
              required
              className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          </div>

          <div className="space-y-1.5">
            <label htmlFor="dropoff-address" className="block text-sm font-medium text-foreground">
              {copy.dropoffAddressLabel} <span className="text-destructive">*</span>
            </label>
            <Input
              id="dropoff-address"
              value={dropoffAddress}
              onChange={(e) => setDropoffAddress(e.target.value)}
              placeholder={copy.dropoffAddressPlaceholder}
              required
              maxLength={200}
              className="h-12 text-sm"
            />
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
              <span className="text-success ml-3 inline-flex items-center gap-1 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" /> Pin de entrega fijado
              </span>
            )}
            {dropoffCoordsError && (
              <p className="mt-2 text-sm text-destructive">{dropoffCoordsError}</p>
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
                  <User className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="recipient-name"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder={copy.recipientNamePlaceholder}
                    required
                    maxLength={100}
                    className="h-12 pl-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="recipient-phone"
                  className="block text-sm font-medium text-foreground"
                >
                  {copy.recipientPhoneLabel} <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="recipient-phone"
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder={copy.recipientPhonePlaceholder}
                    required
                    maxLength={30}
                    className="h-12 pl-9 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Declaración de consentimiento */}
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-border/70 bg-muted/30 p-3.5">
              <input
                id="recipient-consent"
                type="checkbox"
                checked={recipientConsentDeclared}
                onChange={(e) => setRecipientConsentDeclared(e.target.checked)}
                required
                className="mt-1 h-5 w-5 rounded border-border text-primary focus:ring-primary"
              />
              <label
                htmlFor="recipient-consent"
                className="cursor-pointer text-sm leading-relaxed text-foreground"
              >
                {copy.recipientConsentLabel}
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Detalles del paquete */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Package className="h-4 w-4" />
          </div>
          <h2 className="text-base font-semibold text-foreground">{copy.stepPackage}</h2>
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
                  onClick={() => setPackageType(type)}
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
      </section>

      {/* 4. Pago del envío */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Banknote className="h-4 w-4" />
          </div>
          <h2 className="text-base font-semibold text-foreground">{copy.stepPayment}</h2>
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
                      setPaymentMethod(method);
                      if (method !== 'cash') {
                        setNeedsChange(false);
                        setCashChangeAmount(null);
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
                      setNeedsChange(true);
                      if (!cashChangeAmount) {
                        setCashChangeAmount(2000);
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
                      setNeedsChange(false);
                      setCashChangeAmount(null);
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
                      className="h-12 text-sm"
                    />
                    {cashChangeAmount != null && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Monto registrado:{' '}
                        <span className="font-semibold text-foreground">
                          {formatArs(cashChangeAmount)}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 5. Indicaciones adicionales */}
      <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <label htmlFor="notes" className="block text-base font-semibold text-foreground">
          {copy.notesLabel}
        </label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={copy.notesPlaceholder}
          maxLength={500}
          className="min-h-[96px] text-sm"
        />
      </section>

      {/* 6. Botón de envío */}
      <Button
        type="submit"
        size="lg"
        disabled={isPending}
        className="min-h-[52px] w-full rounded-xl text-base font-bold shadow-md"
      >
        {isPending ? copy.submittingButton : copy.submitButton}
      </Button>
    </form>
  );
}
