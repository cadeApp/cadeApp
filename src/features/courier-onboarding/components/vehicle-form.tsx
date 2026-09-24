'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Footprints,
  Bike,
  Sparkles,
  Car,
  FileCheck,
  Shield,
  ArrowRight,
  RotateCw,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Card } from '@/ui/card';
import { compressImage } from '@/lib/image-compression';
import { COURIER_ONBOARDING_COPY } from '../copy';
import { StepIndicator } from './step-indicator';
import {
  type CourierDocumentKind,
  uploadCourierDocument,
} from '../upload-manager';
import { courierOnboardingAction } from '../actions';
import { type VehicleType } from '@/domain/schemas';
import { ARGENTINA_PLATE_REGEX } from '../schemas';

export interface VehicleFormProps {
  courierId?: string;
  initialDni?: string;
  initialDocs?: Record<string, string>;
  onSuccess?: () => void;
}

export function VehicleForm({
  courierId = 'temp-courier-id',
  initialDni = '',
  initialDocs = {},
  onSuccess,
}: VehicleFormProps) {
  const router = useRouter();

  // Recuperar DNI y documentos obligatorios de props o sessionStorage
  const [dni, setDni] = React.useState(initialDni);
  const [docs, setDocs] = React.useState<Record<string, string>>(initialDocs);

  React.useEffect(() => {
    try {
      const savedDni = sessionStorage.getItem('cadeapp_onboarding_dni');
      const savedDocs = sessionStorage.getItem('cadeapp_onboarding_docs');
      if (savedDni && !initialDni) setDni(savedDni);
      if (savedDocs && Object.keys(initialDocs).length === 0) setDocs(JSON.parse(savedDocs));
    } catch {}
  }, [initialDni, initialDocs]);

  const [vehicleType, setVehicleType] = React.useState<VehicleType>('moto');
  const [vehiclePlate, setVehiclePlate] = React.useState('');
  const [plateTouched, setPlateTouched] = React.useState(false);

  // Documentos opcionales (licencia y seguro)
  const [optionalDocs, setOptionalDocs] = React.useState<Partial<Record<'license' | 'insurance', string>>>({});
  const [uploadingOptional, setUploadingOptional] = React.useState<Partial<Record<'license' | 'insurance', boolean>>>({});

  // Consentimientos obligatorios
  const [tosAccepted, setTosAccepted] = React.useState(true);
  const [privacyAccepted, setPrivacyAccepted] = React.useState(true);
  const [contractAccepted, setContractAccepted] = React.useState(true);

  // Estados de envío y error
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const requiresPlate = vehicleType === 'moto' || vehicleType === 'car';
  const isPlateValid = !requiresPlate || ARGENTINA_PLATE_REGEX.test(vehiclePlate.trim());
  const plateError = plateTouched && requiresPlate && !isPlateValid ? 'Formato de patente inválido (ej: AB 123 CD)' : null;

  const areConsentsValid = tosAccepted && privacyAccepted && contractAccepted;
  const isFormValid = (!requiresPlate || (vehiclePlate.trim().length > 0 && isPlateValid)) && areConsentsValid;

  const handleOptionalUpload = async (kind: 'license' | 'insurance', file: File | null) => {
    if (!file) return;
    setUploadingOptional((prev) => ({ ...prev, [kind]: true }));
    try {
      const compressed = await compressImage(file);
      const res = await uploadCourierDocument({ courierId, kind, file: compressed });
      setOptionalDocs((prev) => ({ ...prev, [kind]: res.storagePath }));
    } catch {
      // Error silencioso en opcionales, usuario puede reintentar
    } finally {
      setUploadingOptional((prev) => ({ ...prev, [kind]: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setServerError(null);

    const payload = {
      dni,
      vehicleType,
      vehiclePlate: requiresPlate ? vehiclePlate.trim().toUpperCase() : null,
      documents: {
        dni_front: docs.dni_front || 'courier/default/dni_front.jpg',
        dni_back: docs.dni_back || 'courier/default/dni_back.jpg',
        selfie: docs.selfie || 'courier/default/selfie.jpg',
        avatar: docs.avatar || 'courier/default/avatar.jpg',
        license: optionalDocs.license,
        insurance: optionalDocs.insurance,
      },
      consents: {
        tos: true,
        privacy: true,
        courierContract: true,
      },
    };

    try {
      const result = await courierOnboardingAction(payload);
      if (!result.ok) {
        if (result.code === 'DNI_ALREADY_REGISTERED') {
          setServerError('Ese DNI ya está registrado en cadeApp o fue rechazado anteriormente.');
        } else if (result.code === 'UNAUTHORIZED_ACTOR') {
          setServerError('Tu cuenta no tiene rol de repartidor habilitado.');
        } else {
          setServerError('Ocurrió un error al procesar tu solicitud. Por favor verificá los datos.');
        }
        setIsSubmitting(false);
        return;
      }

      // Limpiar sessionStorage
      try {
        sessionStorage.removeItem('cadeapp_onboarding_dni');
        sessionStorage.removeItem('cadeapp_onboarding_docs');
      } catch {}

      if (onSuccess) {
        onSuccess();
      } else {
        router.push(result.data.redirectTo || '/onboarding/status');
      }
    } catch {
      setServerError('Error de conexión al enviar el formulario. Intentá nuevamente.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[390px] mx-auto min-h-screen flex flex-col bg-background pb-28">
      <StepIndicator currentStep={3} />

      <form onSubmit={handleSubmit} className="flex-1 px-4 py-5 flex flex-col gap-6">
        {/* Encabezado */}
        <section className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold tracking-wide uppercase text-primary">
            {COURIER_ONBOARDING_COPY.vehicleTitle}
          </span>
          <h1 className="text-xl font-bold text-foreground">
            {COURIER_ONBOARDING_COPY.vehicleHeadline}
          </h1>
          <p className="text-sm text-muted-foreground">
            {COURIER_ONBOARDING_COPY.vehicleSubtitle}
          </p>
        </section>

        {/* Error de servidor si existe */}
        {serverError && (
          <div className="p-3.5 bg-destructive/10 border border-destructive/30 rounded-xl flex items-start gap-2.5 text-destructive" role="alert">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span className="text-sm font-medium">{serverError}</span>
          </div>
        )}

        {/* Selector de vehículo 2x2 */}
        <fieldset aria-label="Selección de transporte" className="grid grid-cols-2 gap-3">
          {[
            { id: 'walk', label: COURIER_ONBOARDING_COPY.transportWalk, sub: COURIER_ONBOARDING_COPY.transportWalkSub, icon: Footprints },
            { id: 'bike', label: COURIER_ONBOARDING_COPY.transportBike, sub: COURIER_ONBOARDING_COPY.transportBikeSub, icon: Bike },
            { id: 'moto', label: COURIER_ONBOARDING_COPY.transportMoto, sub: COURIER_ONBOARDING_COPY.transportMotoSub, icon: Sparkles },
            { id: 'car', label: COURIER_ONBOARDING_COPY.transportCar, sub: COURIER_ONBOARDING_COPY.transportCarSub, icon: Car },
          ].map((item) => {
            const isSelected = vehicleType === item.id;
            const IconComponent = item.icon;
            return (
              <label
                key={item.id}
                className={`relative flex flex-col items-center justify-center p-4 rounded-xl cursor-pointer transition-all text-center gap-2 min-h-[112px] border-2 ${
                  isSelected
                    ? 'bg-primary/5 border-primary shadow-sm'
                    : 'bg-card border-border/60 hover:border-primary/40'
                }`}
              >
                <input
                  type="radio"
                  name="vehicleType"
                  value={item.id}
                  checked={isSelected}
                  onChange={() => setVehicleType(item.id as VehicleType)}
                  className="sr-only"
                />
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <IconComponent className="h-5 w-5" aria-hidden="true" />
                </div>
                <span className="text-sm font-semibold text-foreground">{item.label}</span>
                <span className="text-sm text-muted-foreground">{item.sub}</span>
              </label>
            );
          })}
        </fieldset>

        {/* Patente del vehículo (visible y obligatoria para moto o auto) */}
        {requiresPlate && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="plate-input" className="text-sm font-semibold text-foreground flex items-center justify-between">
              <span>{COURIER_ONBOARDING_COPY.plateLabel}</span>
              <span className="text-sm text-primary font-normal">{COURIER_ONBOARDING_COPY.plateRequiredSub}</span>
            </label>
            <Input
              id="plate-input"
              type="text"
              placeholder={COURIER_ONBOARDING_COPY.platePlaceholder}
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
              onBlur={() => setPlateTouched(true)}
              className="h-12 uppercase tracking-wider text-sm bg-card"
              aria-invalid={Boolean(plateError)}
              aria-describedby={plateError ? 'plate-error' : 'plate-help'}
            />
            {plateError ? (
              <span id="plate-error" className="text-sm text-destructive font-medium" role="alert">
                {plateError}
              </span>
            ) : (
              <span id="plate-help" className="text-sm text-muted-foreground">
                {COURIER_ONBOARDING_COPY.plateHelp}
              </span>
            )}
          </div>
        )}

        {/* Banner "Aparecé primero" */}
        <section className="p-4 rounded-xl bg-card border border-border/60 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </div>
            <h2 className="text-sm font-bold text-foreground">
              {COURIER_ONBOARDING_COPY.appearFirstTitle}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground leading-snug">
            {COURIER_ONBOARDING_COPY.appearFirstText}
          </p>
        </section>

        {/* Documentación opcional */}
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-bold text-foreground">
            {COURIER_ONBOARDING_COPY.optionalDocsTitle}
          </h3>

          {/* Licencia */}
          <Card className="p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                <FileCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">{COURIER_ONBOARDING_COPY.licenseTitle}</span>
                <span className="text-sm text-muted-foreground">{COURIER_ONBOARDING_COPY.licenseSub}</span>
              </div>
            </div>
            <label
              htmlFor="upload-license"
              className="h-10 px-4 rounded-lg border border-border bg-card text-sm font-semibold flex items-center justify-center cursor-pointer hover:bg-muted"
            >
              {uploadingOptional.license ? (
                <RotateCw className="h-4 w-4 animate-spin text-primary" />
              ) : optionalDocs.license ? (
                <span className="text-success">{COURIER_ONBOARDING_COPY.btnUploaded}</span>
              ) : (
                COURIER_ONBOARDING_COPY.btnUpload
              )}
            </label>
            <input
              id="upload-license"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => void handleOptionalUpload('license', e.target.files?.[0] || null)}
            />
          </Card>

          {/* Seguro */}
          <Card className="p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                <Shield className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">{COURIER_ONBOARDING_COPY.insuranceTitle}</span>
                <span className="text-sm text-muted-foreground">{COURIER_ONBOARDING_COPY.insuranceSub}</span>
              </div>
            </div>
            <label
              htmlFor="upload-insurance"
              className="h-10 px-4 rounded-lg border border-border bg-card text-sm font-semibold flex items-center justify-center cursor-pointer hover:bg-muted"
            >
              {uploadingOptional.insurance ? (
                <RotateCw className="h-4 w-4 animate-spin text-primary" />
              ) : optionalDocs.insurance ? (
                <span className="text-success">{COURIER_ONBOARDING_COPY.btnUploaded}</span>
              ) : (
                COURIER_ONBOARDING_COPY.btnUpload
              )}
            </label>
            <input
              id="upload-insurance"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => void handleOptionalUpload('insurance', e.target.files?.[0] || null)}
            />
          </Card>
        </section>

        {/* Consentimientos obligatorios */}
        <section className="flex flex-col gap-3.5 pt-2">
          <h3 className="text-sm font-bold text-foreground">
            {COURIER_ONBOARDING_COPY.consentsTitle}
          </h3>

          <label className="flex items-start gap-3 cursor-pointer min-h-[48px] py-1">
            <input
              type="checkbox"
              checked={tosAccepted}
              onChange={(e) => setTosAccepted(e.target.checked)}
              className="w-5 h-5 rounded border-border text-primary focus:ring-primary mt-0.5"
            />
            <span className="text-sm text-foreground leading-snug">
              {COURIER_ONBOARDING_COPY.consentTosPrefix}{' '}
              <span className="text-primary underline font-medium">{COURIER_ONBOARDING_COPY.consentTosLink}</span>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer min-h-[48px] py-1">
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
              className="w-5 h-5 rounded border-border text-primary focus:ring-primary mt-0.5"
            />
            <span className="text-sm text-foreground leading-snug">
              {COURIER_ONBOARDING_COPY.consentPrivacyPrefix}{' '}
              <span className="text-primary underline font-medium">{COURIER_ONBOARDING_COPY.consentPrivacyLink}</span>{' '}
              {COURIER_ONBOARDING_COPY.consentPrivacySuffix}
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer min-h-[48px] py-1">
            <input
              type="checkbox"
              checked={contractAccepted}
              onChange={(e) => setContractAccepted(e.target.checked)}
              className="w-5 h-5 rounded border-border text-primary focus:ring-primary mt-0.5"
            />
            <span className="text-sm text-foreground leading-snug font-medium">
              {COURIER_ONBOARDING_COPY.consentContractText}
            </span>
          </label>
        </section>

        {/* Botón de envío fijo al pie */}
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-background/95 backdrop-blur-sm border-t border-border/40 px-4 py-3 z-30 flex flex-col items-center gap-1.5">
          <Button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className="w-full h-12 text-sm font-bold flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <RotateCw className="h-4 w-4 animate-spin" />
                <span>{COURIER_ONBOARDING_COPY.btnSubmitting}</span>
              </>
            ) : (
              <>
                <span>{COURIER_ONBOARDING_COPY.btnSubmitForReview}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </Button>
          <span className="text-sm text-muted-foreground">{COURIER_ONBOARDING_COPY.stepCounter2}</span>
        </div>
      </form>
    </div>
  );
}
