'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  type FieldErrors,
  useFieldArray,
  useForm,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormWatch,
} from 'react-hook-form';
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
  Plus,
  Trash2,
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
import { MapSkeleton } from '@/ui/map-skeleton';
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

const MapPicker = dynamic(
  () => import('@/ui/map').then((mod) => mod.MapPicker),
  {
    ssr: false,
    loading: () => <MapSkeleton className="h-64 w-full" />,
  }
);

export interface CreateRequestFormProps {
  readonly zones: ZoneOption[];
  readonly defaultPickup?: MerchantDefaultPickup | null;
  readonly maxDrops?: number;
}

interface DropCardProps {
  readonly fieldId: string;
  readonly index: number;
  readonly totalDrops: number;
  readonly canRemove: boolean;
  readonly onRemove: () => void;
  readonly zones: ZoneOption[];
  readonly register: UseFormRegister<CreateDeliveryRequestInput>;
  readonly setValue: UseFormSetValue<CreateDeliveryRequestInput>;
  readonly watch: UseFormWatch<CreateDeliveryRequestInput>;
  readonly errors?: FieldErrors<CreateDeliveryRequestInput>;
  readonly onSetDropoffCoords: (
    fieldId: string,
    coords: { lat: number | null; lng: number | null }
  ) => void;
}

function DropCard({
  fieldId,
  index,
  totalDrops,
  canRemove,
  onRemove,
  zones,
  register,
  setValue,
  watch,
  errors,
  onSetDropoffCoords,
}: DropCardProps) {
  const copy = requestsCopy.newRequest;

  // Estados locales independientes por tarjeta (aislados por componente y clave estable fieldId)
  const [dropoffLocating, setDropoffLocating] = React.useState(false);
  const [dropoffCoordsError, setDropoffCoordsError] = React.useState<string | null>(null);
  const [showDropoffMap, setShowDropoffMap] = React.useState(false);
  const [customChangeInput, setCustomChangeInput] = React.useState('');

  const dropLat = watch(`drops.${index}.dropoffLat`);
  const dropLng = watch(`drops.${index}.dropoffLng`);
  const dropZoneId = watch(`drops.${index}.dropoffZoneId`);
  const dropZone = zones.find((z) => z.id === dropZoneId);
  const dropZoneCenter =
    dropZone?.centroidLat != null && dropZone?.centroidLng != null
      ? { lat: dropZone.centroidLat, lng: dropZone.centroidLng }
      : null;

  const packageType = watch(`drops.${index}.packageType`);
  const paymentMethod = watch(`drops.${index}.recipientPaymentMethod`);
  const needsChange = watch(`drops.${index}.needsChange`);
  const cashChangeAmount = watch(`drops.${index}.cashChangeAmount`);

  const dropErrors = errors?.drops?.[index];

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
          onSetDropoffCoords(fieldId, { lat: null, lng: null });
          return;
        }
        onSetDropoffCoords(fieldId, { lat: latitude, lng: longitude });
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
    setValue(`drops.${index}.cashChangeAmount`, amount, { shouldValidate: true });
    setCustomChangeInput('');
  };

  const handleCustomChangeChange = (val: string) => {
    setCustomChangeInput(val);
    const parsed = Number.parseInt(val.replace(/\D/g, ''), 10);
    setValue(
      `drops.${index}.cashChangeAmount`,
      Number.isNaN(parsed) || parsed <= 0 ? null : parsed,
      { shouldValidate: true }
    );
  };

  return (
    <Card className="space-y-4 p-5 sm:p-6" data-testid={`drop-card-${index}`}>
      {/* Encabezado de la entrega */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-primary-dark" aria-hidden="true" />
          <h2 className="font-display text-base font-bold text-foreground">
            {totalDrops === 1 ? copy.stepDropoff : copy.dropCardTitle(index + 1)}
          </h2>
          <Badge
            variant="outline"
            className="border-primary/30 text-sm font-medium text-primary-dark ml-1"
            aria-label={copy.dropCounterAria(index + 1, totalDrops)}
          >
            {totalDrops > 1 ? copy.dropCounterAria(index + 1, totalDrops) : copy.dropCardTitle(index + 1)}
          </Badge>
        </div>

        {/* Botón Quitar entrega */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Quitar entrega ${index + 1}`}
          className={cn(
            'min-h-11 px-3 text-sm font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive',
            !canRemove && 'opacity-40 cursor-not-allowed'
          )}
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          {copy.removeDropButton}
        </Button>
      </div>

      <div className="space-y-3">
        {/* Barrio de entrega */}
        <div className="space-y-1.5">
          <label
            htmlFor={`dropoff-zone-${fieldId}`}
            className="block text-sm font-medium text-foreground"
          >
            {copy.dropoffZoneLabel} <span className="text-destructive">*</span>
          </label>
          <select
            id={`dropoff-zone-${fieldId}`}
            {...register(`drops.${index}.dropoffZoneId`)}
            aria-invalid={Boolean(dropErrors?.dropoffZoneId)}
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
          {dropErrors?.dropoffZoneId && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {dropErrors.dropoffZoneId.message}
            </p>
          )}
        </div>

        {/* Dirección de entrega */}
        <div className="space-y-1.5">
          <label
            htmlFor={`dropoff-address-${fieldId}`}
            className="block text-sm font-medium text-foreground"
          >
            {copy.dropoffAddressLabel} <span className="text-destructive">*</span>
          </label>
          <Input
            id={`dropoff-address-${fieldId}`}
            {...register(`drops.${index}.dropoffAddress`)}
            placeholder={copy.dropoffAddressPlaceholder}
            maxLength={200}
            aria-invalid={Boolean(dropErrors?.dropoffAddress)}
          />
          {dropErrors?.dropoffAddress && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {dropErrors.dropoffAddress.message}
            </p>
          )}
        </div>

        {/* Geolocalización y mapa */}
        <div className="pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowDropoffMap((prev) => !prev)}
              className="min-h-12 gap-2 text-sm"
            >
              <MapPin className="h-4 w-4 text-primary-dark" />
              {showDropoffMap ? 'Ocultar mapa' : 'Fijar en mapa interactivo'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUseMyLocationDropoff}
              disabled={dropoffLocating}
              className="min-h-12 gap-2 text-sm"
            >
              <Navigation className="h-4 w-4 text-primary-dark" />
              {dropoffLocating ? 'Obteniendo GPS...' : 'Usar mi ubicación'}
            </Button>
            {dropLat != null && dropLng != null && !dropoffCoordsError && (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary-dark">
                <CheckCircle2 className="h-4 w-4" /> Pin fijado
              </span>
            )}
          </div>

          {showDropoffMap && (
            <div className="mt-3 rounded-xl border border-border bg-muted/20 p-3">
              <MapPicker
                value={
                  dropLat != null && dropLng != null ? { lat: dropLat, lng: dropLng } : null
                }
                onChange={(coords) => {
                  onSetDropoffCoords(fieldId, coords);
                  setDropoffCoordsError(null);
                }}
                defaultZoneCenter={dropZoneCenter}
              />
            </div>
          )}

          {dropoffCoordsError && (
            <p className="mt-2 text-sm text-destructive">{dropoffCoordsError}</p>
          )}
          {dropErrors?.dropoffLat && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {dropErrors.dropoffLat.message}
            </p>
          )}
        </div>

        {/* Datos del destinatario */}
        <div className="mt-4 border-t border-border pt-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Datos del destinatario</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor={`recipient-name-${fieldId}`}
                className="block text-sm font-medium text-foreground"
              >
                {copy.recipientNameLabel} <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                <Input
                  id={`recipient-name-${fieldId}`}
                  {...register(`drops.${index}.recipientName`)}
                  placeholder={copy.recipientNamePlaceholder}
                  maxLength={100}
                  aria-invalid={Boolean(dropErrors?.recipientName)}
                  className="pl-10"
                />
              </div>
              {dropErrors?.recipientName && (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {dropErrors.recipientName.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor={`recipient-phone-${fieldId}`}
                className="block text-sm font-medium text-foreground"
              >
                {copy.recipientPhoneLabel} <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                <Input
                  id={`recipient-phone-${fieldId}`}
                  type="tel"
                  inputMode="tel"
                  {...register(`drops.${index}.recipientPhone`)}
                  placeholder={copy.recipientPhonePlaceholder}
                  maxLength={30}
                  aria-invalid={Boolean(dropErrors?.recipientPhone)}
                  className="pl-10"
                />
              </div>
              {dropErrors?.recipientPhone && (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {dropErrors.recipientPhone.message}
                </p>
              )}
            </div>
          </div>

          {/* Declaración de consentimiento */}
          <div className="mt-4 flex flex-col gap-1.5">
            <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/30 p-3.5">
              <input
                id={`recipient-consent-${fieldId}`}
                type="checkbox"
                {...register(`drops.${index}.recipientConsentDeclared`)}
                className="mt-1 h-5 w-5 rounded border-border text-primary focus:ring-primary"
              />
              <label
                htmlFor={`recipient-consent-${fieldId}`}
                className="cursor-pointer text-sm leading-relaxed text-foreground"
              >
                {copy.recipientConsentLabel}
              </label>
            </div>
            {dropErrors?.recipientConsentDeclared && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {dropErrors.recipientConsentDeclared.message}
              </p>
            )}
          </div>
        </div>

        {/* Tamaño del paquete */}
        <div className="mt-4 border-t border-border pt-4 space-y-2">
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
                  onClick={() => setValue(`drops.${index}.packageType`, type, { shouldValidate: true })}
                  className={cn(
                    'flex min-h-[58px] flex-col items-start justify-center rounded-lg border p-3 text-left transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/10 font-semibold text-primary-dark'
                      : 'border-border bg-background text-foreground hover:bg-muted/50'
                  )}
                >
                  <span className="text-sm font-bold capitalize">{opt.label}</span>
                  <span
                    className={cn(
                      'line-clamp-2 text-sm font-normal',
                      isSelected ? 'text-primary-dark' : 'text-muted-foreground'
                    )}
                  >
                    {opt.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pago del envío */}
        <div className="mt-4 border-t border-border pt-4 space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary-dark" />
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
                      setValue(`drops.${index}.recipientPaymentMethod`, method, {
                        shouldValidate: true,
                      });
                      if (method !== 'cash') {
                        setValue(`drops.${index}.needsChange`, false, { shouldValidate: true });
                        setValue(`drops.${index}.cashChangeAmount`, null, { shouldValidate: true });
                        setCustomChangeInput('');
                      }
                    }}
                    className={cn(
                      'flex min-h-[48px] items-center justify-center gap-2 rounded-lg border p-3 text-sm font-semibold transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary-dark'
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
                      setValue(`drops.${index}.needsChange`, true, { shouldValidate: true });
                      if (!cashChangeAmount) {
                        setValue(`drops.${index}.cashChangeAmount`, 2000, { shouldValidate: true });
                      }
                    }}
                    className="min-h-12 min-w-[60px] text-sm"
                  >
                    Sí
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={!needsChange ? 'default' : 'outline'}
                    onClick={() => {
                      setValue(`drops.${index}.needsChange`, false, { shouldValidate: true });
                      setValue(`drops.${index}.cashChangeAmount`, null, { shouldValidate: true });
                      setCustomChangeInput('');
                    }}
                    className="min-h-12 min-w-[60px] text-sm"
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
                            'min-h-12 rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
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
                      aria-invalid={Boolean(dropErrors?.cashChangeAmount)}
                    />
                    {cashChangeAmount != null && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Monto registrado:{' '}
                        <span className="font-semibold text-foreground">
                          {formatArs(cashChangeAmount)}
                        </span>
                      </p>
                    )}
                    {dropErrors?.cashChangeAmount && (
                      <p role="alert" className="mt-1 text-sm font-medium text-destructive">
                        {dropErrors.cashChangeAmount.message}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Indicaciones de entrega */}
        <div className="mt-4 border-t border-border pt-4 space-y-1.5">
          <label
            htmlFor={`notes-${fieldId}`}
            className="block text-sm font-medium text-foreground"
          >
            {copy.notesLabel}
          </label>
          <Textarea
            id={`notes-${fieldId}`}
            {...register(`drops.${index}.notes`)}
            placeholder={copy.notesPlaceholder}
            maxLength={500}
            aria-invalid={Boolean(dropErrors?.notes)}
            className="min-h-[80px]"
          />
          {dropErrors?.notes && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {dropErrors.notes.message}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

export function CreateRequestForm({
  zones,
  defaultPickup,
  maxDrops = 5,
}: CreateRequestFormProps) {
  const router = useRouter();
  const copy = requestsCopy.newRequest;

  // Estados efímeros de UI para punto de retiro
  const [pickupLocating, setPickupLocating] = React.useState(false);
  const [pickupCoordsError, setPickupCoordsError] = React.useState<string | null>(null);

  const [fixedPriceInput, setFixedPriceInput] = React.useState('');
  const [serverError, setServerError] = React.useState<string | null>(null);

  // Formulario gobernado por react-hook-form + zodResolver
  const {
    register,
    control,
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
      fixedPriceArs: null,
      autoAssign: false,
      drops: [
        {
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
          notes: '',
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'drops',
  });

  // CC-024 / Decisión B: requestId estable generado por intención de creación y reusado en retries
  const requestIdRef = React.useRef<string>(crypto.randomUUID());

  // CC-024 / H07: memoria del último intento para detectar reintentos con payload editado
  const lastAttemptRef = React.useRef<{
    requestId: string;
    originalPayload: CreateDeliveryRequestOutput;
    canonical: string;
  } | null>(null);

  const [payloadConflict, setPayloadConflict] = React.useState<boolean>(false);
  const [showNewRequestConfirm, setShowNewRequestConfirm] = React.useState<boolean>(false);
  const [isSubmittingOriginal, setIsSubmittingOriginal] = React.useState<boolean>(false);

  // Referencia mutable a los campos para resolver índices actuales por fieldId estable (R1 riesgo GPS)
  const fieldsRef = React.useRef(fields);
  fieldsRef.current = fields;

  const handleSetDropoffCoords = React.useCallback(
    (fieldId: string, coords: { lat: number | null; lng: number | null }) => {
      const currentIndex = fieldsRef.current.findIndex((f) => f.id === fieldId);
      if (currentIndex === -1) {
        // La tarjeta fue eliminada mientras la geolocalización estaba pendiente; no mutar nada
        return;
      }
      setValue(`drops.${currentIndex}.dropoffLat`, coords.lat, { shouldValidate: true });
      setValue(`drops.${currentIndex}.dropoffLng`, coords.lng, { shouldValidate: true });
    },
    [setValue]
  );

  const pickupLat = watch('pickupLat');
  const pickupLng = watch('pickupLng');
  const fixedPriceArs = watch('fixedPriceArs');
  const autoAssign = watch('autoAssign');

  const handleFixedPriceChange = (val: string) => {
    setFixedPriceInput(val);
    const cleaned = val.replace(/\D/g, '');
    if (!cleaned) {
      setValue('fixedPriceArs', null, { shouldValidate: true });
      setValue('autoAssign', false, { shouldValidate: true });
    } else {
      const num = parseInt(cleaned, 10);
      setValue('fixedPriceArs', num, { shouldValidate: true });
    }
  };

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

  const onSubmit = async (data: CreateDeliveryRequestOutput) => {
    setServerError(null);

    const canonical = JSON.stringify(data);

    // CC-024 / H07: Si hubo un intento previo que falló o tuvo respuesta incierta
    // y los datos normalizados actuales difieren del snapshot original,
    // NO invocar a la Server Action automáticamente. Exigir decisión explícita.
    if (lastAttemptRef.current !== null && lastAttemptRef.current.canonical !== canonical) {
      setPayloadConflict(true);
      return;
    }

    // Si es el primer intento, registrar snapshot en memoria
    if (lastAttemptRef.current === null) {
      lastAttemptRef.current = {
        requestId: requestIdRef.current,
        originalPayload: data,
        canonical,
      };
    }

    try {
      const result = await createDeliveryRequestAction({
        ...data,
        requestId: requestIdRef.current,
      });

      if (!result.ok) {
        const msg = getDomainErrorMessage(result.code);
        setServerError(msg);
        notify.error(msg);
        return;
      }

      // Éxito: limpiar snapshot y regenerar requestId para que una nueva intención futura tenga un nuevo UUID
      lastAttemptRef.current = null;
      setPayloadConflict(false);
      setShowNewRequestConfirm(false);
      requestIdRef.current = crypto.randomUUID();
      notify.success('Solicitud publicada con éxito');
      router.push(result.data.redirectTo);
    } catch {
      setServerError(copy.errorGeneric);
      notify.error(copy.errorGeneric);
    }
  };

  // CC-024 / H07 Opción 1: Reintentar solicitud original con el mismo requestId y payload original intacto
  const handleRetryOriginal = async () => {
    if (!lastAttemptRef.current) return;
    setServerError(null);
    setIsSubmittingOriginal(true);
    try {
      const result = await createDeliveryRequestAction({
        ...lastAttemptRef.current.originalPayload,
        requestId: lastAttemptRef.current.requestId,
      });

      if (!result.ok) {
        const msg = getDomainErrorMessage(result.code);
        setServerError(msg);
        notify.error(msg);
        return;
      }

      lastAttemptRef.current = null;
      setPayloadConflict(false);
      setShowNewRequestConfirm(false);
      requestIdRef.current = crypto.randomUUID();
      notify.success('Solicitud publicada con éxito');
      router.push(result.data.redirectTo);
    } catch {
      setServerError(copy.errorGeneric);
      notify.error(copy.errorGeneric);
    } finally {
      setIsSubmittingOriginal(false);
    }
  };

  // CC-024 / H07 Opción 2: Comenzar otra solicitud -> tras confirmación de usuario, gira a UUID nuevo y limpia snapshot
  const handleConfirmNewRequest = () => {
    requestIdRef.current = crypto.randomUUID();
    lastAttemptRef.current = null;
    setPayloadConflict(false);
    setShowNewRequestConfirm(false);
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

      {payloadConflict && (
        <div
          role="alert"
          className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">{copy.payloadConflictAlert}</p>
              {showNewRequestConfirm && (
                <p className="text-sm font-medium text-destructive">
                  {copy.payloadConflictWarning}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRetryOriginal}
              disabled={isSubmittingOriginal}
              className="border-amber-600/40 hover:bg-amber-500/20"
            >
              {isSubmittingOriginal ? 'Reintentando...' : copy.retryOriginalButton}
            </Button>

            {!showNewRequestConfirm ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowNewRequestConfirm(true)}
              >
                {copy.startNewRequestButton}
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleConfirmNewRequest}
                >
                  {copy.confirmNewRequestButton}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewRequestConfirm(false)}
                >
                  {copy.cancelNewRequestButton}
                </Button>
              </div>
            )}
          </div>
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
            <Badge
              variant="outline"
              className="border-primary/30 text-sm font-medium text-primary-dark"
            >
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
              className="min-h-12 gap-2 text-sm"
            >
              <Navigation className="h-4 w-4 text-primary-dark" />
              {pickupLocating ? 'Obteniendo GPS...' : copy.useMyLocation}
            </Button>
            {pickupLat != null && pickupLng != null && !pickupCoordsError && (
              <span className="ml-3 inline-flex items-center gap-1 text-sm font-medium text-primary-dark">
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

      {/* 2. Tarjetas repetibles de entregas (useFieldArray con keys estables field.id) */}
      <div className="space-y-4">
        {fields.map((field, index) => (
          <DropCard
            key={field.id}
            fieldId={field.id}
            index={index}
            totalDrops={fields.length}
            canRemove={fields.length > 1}
            onRemove={() => remove(index)}
            zones={zones}
            register={register}
            setValue={setValue}
            watch={watch}
            errors={errors}
            onSetDropoffCoords={handleSetDropoffCoords}
          />
        ))}

        {/* Barra de control multi-drop: contador y botón "Agregar otra entrega" */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-dashed border-border bg-card/60 p-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm font-semibold px-2.5 py-1">
              {fields.length} / {maxDrops} entregas
            </Badge>
            {fields.length >= maxDrops && (
              <span role="status" className="text-sm text-muted-foreground font-medium">
                {copy.dropsLimitReached(maxDrops)}
              </span>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (fields.length < maxDrops) {
                append({
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
                  notes: '',
                });
              }
            }}
            disabled={fields.length >= maxDrops}
            className="min-h-11 gap-2 text-sm font-semibold border-primary/40 text-primary-dark hover:bg-primary/10"
          >
            <Plus className="h-4 w-4" />
            {copy.addDropButton}
          </Button>
        </div>
        {errors.drops && typeof errors.drops.message === 'string' && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {errors.drops.message}
          </p>
        )}
      </div>

      {/* 3. Precio de envío acordado (opcional) */}
      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Banknote className="h-4 w-4 text-primary-dark" aria-hidden="true" />
          <h2 className="font-display text-base font-bold text-foreground">
            {copy.fixedPriceSection}
          </h2>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{copy.fixedPriceHint}</p>
          <p className="text-sm text-muted-foreground/90">{copy.fixedPricePerDropHint}</p>

          <div className="space-y-2">
            <label htmlFor="fixedPriceArs" className="block text-sm font-medium text-foreground">
              {copy.fixedPriceLabel}
            </label>
            <Input
              id="fixedPriceArs"
              type="text"
              inputMode="numeric"
              value={fixedPriceInput}
              onChange={(e) => handleFixedPriceChange(e.target.value)}
              placeholder={copy.fixedPricePlaceholder}
              aria-invalid={Boolean(errors.fixedPriceArs)}
            />
            {fixedPriceArs != null && fixedPriceArs > 0 && (
              <div className="rounded-lg bg-primary/10 p-3 space-y-1 text-sm border border-primary/20">
                <p className="font-medium text-primary-dark">
                  Precio por entrega:{' '}
                  <span className="font-bold">{formatArs(fixedPriceArs)}</span>
                </p>
                <p className="font-bold text-foreground">
                  Total cotizado al repartidor:{' '}
                  <span className="text-primary-dark font-extrabold text-base">
                    {formatArs(fixedPriceArs * fields.length)}
                  </span>{' '}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({fields.length} {fields.length === 1 ? 'entrega' : 'entregas'})
                  </span>
                </p>
              </div>
            )}
            {errors.fixedPriceArs && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {errors.fixedPriceArs.message}
              </p>
            )}
          </div>

          {/* Switch de asignación automática: se muestra SOLO si hay precio cargado */}
          {fixedPriceArs != null && fixedPriceArs > 0 && (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex-1">
                <label
                  htmlFor="autoAssignSwitch"
                  className="cursor-pointer text-sm font-semibold text-foreground"
                >
                  {copy.autoAssignLabel}
                </label>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {copy.autoAssignHint}
                </p>
              </div>
              <button
                id="autoAssignSwitch"
                type="button"
                role="switch"
                aria-checked={Boolean(autoAssign)}
                aria-label={copy.autoAssignLabel}
                onClick={() => setValue('autoAssign', !autoAssign, { shouldValidate: true })}
                className="relative inline-flex min-h-12 min-w-12 items-center justify-center rounded-full p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span
                  className={cn(
                    'inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                    autoAssign ? 'bg-primary' : 'bg-muted'
                  )}
                >
                  <span
                    className={cn(
                      'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
                      autoAssign ? 'translate-x-5' : 'translate-x-0.5'
                    )}
                  />
                </span>
              </button>
            </div>
          )}
          {errors.autoAssign && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {errors.autoAssign.message}
            </p>
          )}
        </div>
      </Card>

      {/* 4. Botón de envío */}
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
