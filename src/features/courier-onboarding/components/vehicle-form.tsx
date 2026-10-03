'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Footprints,
  Bike,
  ShieldCheck,
  Car,
  FileCheck,
  Shield,
  ArrowRight,
  RotateCw,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Card } from '@/ui/card';
import { BrandLogo } from '@/ui/brand-logo';
import { compressImage } from '@/lib/image-compression';
import { COURIER_ONBOARDING_COPY } from '../copy';
import { StepIndicator } from './step-indicator';
import { DocumentUploadCard, type DocumentUploadStatus } from './document-upload-card';
import { type CourierDocumentKind, uploadCourierDocument } from '../upload-manager';
import { courierOnboardingAction } from '../actions';
import { ARGENTINA_PLATE_REGEX } from '../schemas';
import type { VehicleType } from '@/domain/schemas';
import Link from 'next/link';
import { getLegalDocument } from '@/features/legal';

export interface VehicleFormProps {
  courierId: string;
  initialDni?: string;
  initialDocs?: Record<string, string>;
  onSuccess?: () => void;
}

const EMPTY_INITIAL_DOCS: Record<string, string> = {};

type OptionalDocumentKind = Extract<CourierDocumentKind, 'license' | 'insurance'>;

const OPTIONAL_DOCS: {
  kind: OptionalDocumentKind;
  title: string;
  subtitle: string;
  icon: LucideIcon;
}[] = [
  {
    kind: 'license',
    title: COURIER_ONBOARDING_COPY.licenseTitle,
    subtitle: COURIER_ONBOARDING_COPY.licenseSub,
    icon: FileCheck,
  },
  {
    kind: 'insurance',
    title: COURIER_ONBOARDING_COPY.insuranceTitle,
    subtitle: COURIER_ONBOARDING_COPY.insuranceSub,
    icon: Shield,
  },
];

export function VehicleForm({
  courierId,
  initialDni = '',
  initialDocs = EMPTY_INITIAL_DOCS,
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

  // Documentos opcionales (licencia y seguro): mismos estados que el paso 2 (T-325)
  const [optionalDocs, setOptionalDocs] = React.useState<
    Partial<Record<OptionalDocumentKind, string>>
  >({});
  const [optionalStatuses, setOptionalStatuses] = React.useState<
    Partial<Record<OptionalDocumentKind, DocumentUploadStatus>>
  >({});
  const [compressingOptional, setCompressingOptional] = React.useState<
    Partial<Record<OptionalDocumentKind, boolean>>
  >({});
  const [optionalFileNames, setOptionalFileNames] = React.useState<
    Partial<Record<OptionalDocumentKind, string>>
  >({});

  // Consentimientos obligatorios
  const [tosAccepted, setTosAccepted] = React.useState(false);
  const [privacyAccepted, setPrivacyAccepted] = React.useState(false);
  const [contractAccepted, setContractAccepted] = React.useState(false);

  // Estados de envío y error
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const requiresPlate = vehicleType === 'moto' || vehicleType === 'car';
  const isPlateValid = !requiresPlate || ARGENTINA_PLATE_REGEX.test(vehiclePlate.trim());
  const plateError =
    plateTouched && requiresPlate && !isPlateValid
      ? 'Formato de patente inválido (ej: AB 123 CD)'
      : null;

  const areConsentsValid = tosAccepted && privacyAccepted && contractAccepted;
  const isFormValid =
    (!requiresPlate || (vehiclePlate.trim().length > 0 && isPlateValid)) && areConsentsValid;

  const handleOptionalUpload = async (kind: OptionalDocumentKind, file: File) => {
    setOptionalFileNames((prev) => ({ ...prev, [kind]: file.name }));
    setCompressingOptional((prev) => ({ ...prev, [kind]: true }));
    setOptionalStatuses((prev) => ({ ...prev, [kind]: 'uploading' }));
    // Un reintento reemplaza la carga anterior: mientras sube no se envía una ruta vieja.
    setOptionalDocs((prev) => ({ ...prev, [kind]: undefined }));

    try {
      const compressed = await compressImage(file);
      setCompressingOptional((prev) => ({ ...prev, [kind]: false }));
      const res = await uploadCourierDocument({ courierId, kind, file: compressed });
      setOptionalDocs((prev) => ({ ...prev, [kind]: res.storagePath }));
      setOptionalStatuses((prev) => ({ ...prev, [kind]: 'success' }));
    } catch {
      // Opcional, pero no silencioso: la tarjeta muestra el error y permite reintentar.
      setCompressingOptional((prev) => ({ ...prev, [kind]: false }));
      setOptionalStatuses((prev) => ({ ...prev, [kind]: 'error' }));
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
        license: requiresPlate ? optionalDocs.license : undefined,
        insurance: requiresPlate ? optionalDocs.insurance : undefined,
      },
      consents: {
        tos: tosAccepted,
        privacy: privacyAccepted,
        courierContract: contractAccepted,
        tosVersion: getLegalDocument('tos').version,
        privacyVersion: getLegalDocument('privacy').version,
        courierContractVersion: getLegalDocument('courier_contract').version,
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
          setServerError(
            'Ocurrió un error al procesar tu solicitud. Por favor verificá los datos.'
          );
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
        router.push(result.data.redirectTo || '/courier/onboarding/status');
      }
    } catch {
      setServerError('Error de conexión al enviar el formulario. Intentá nuevamente.');
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-lg overflow-hidden">
      <StepIndicator currentStep={3} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-6 sm:p-8">
        {/* Encabezado */}
        <section className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold uppercase tracking-wide text-primary-dark">
            {COURIER_ONBOARDING_COPY.vehicleTitle}
          </span>
          <h1 className="font-display text-xl font-bold text-foreground">
            {COURIER_ONBOARDING_COPY.vehicleHeadline}
          </h1>
          <p className="text-sm text-muted-foreground">{COURIER_ONBOARDING_COPY.vehicleSubtitle}</p>
        </section>

        {/* Error de servidor si existe */}
        {serverError && (
          <div
            className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-destructive"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <span className="text-sm font-medium">{serverError}</span>
          </div>
        )}

        {/* Selector de vehículo 2x2 */}
        <fieldset aria-label="Selección de transporte" className="grid grid-cols-2 gap-3">
          {[
            {
              id: 'walk',
              label: COURIER_ONBOARDING_COPY.transportWalk,
              sub: COURIER_ONBOARDING_COPY.transportWalkSub,
              icon: Footprints,
            },
            {
              id: 'bike',
              label: COURIER_ONBOARDING_COPY.transportBike,
              sub: COURIER_ONBOARDING_COPY.transportBikeSub,
              icon: Bike,
            },
            {
              id: 'moto',
              label: COURIER_ONBOARDING_COPY.transportMoto,
              sub: COURIER_ONBOARDING_COPY.transportMotoSub,
              icon: null,
            },
            {
              id: 'car',
              label: COURIER_ONBOARDING_COPY.transportCar,
              sub: COURIER_ONBOARDING_COPY.transportCarSub,
              icon: Car,
            },
          ].map((item) => {
            const isSelected = vehicleType === item.id;
            const IconComponent = item.icon;
            return (
              <label
                key={item.id}
                className={`relative flex min-h-[112px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 text-center transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border/60 bg-card hover:border-primary/40'
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
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {IconComponent ? (
                    <IconComponent className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <BrandLogo showWordmark={false} className="h-6 w-auto" />
                  )}
                </div>
                <span className="text-sm font-semibold text-foreground">{item.label}</span>
                <span className="text-sm text-muted-foreground">{item.sub}</span>
              </label>
            );
          })}
        </fieldset>

        {/* Patente y documentación vehicular (solo visible para moto o auto) */}
        {requiresPlate && (
          <>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="plate-input"
                className="flex items-center justify-between text-sm font-semibold text-foreground"
              >
                <span>{COURIER_ONBOARDING_COPY.plateLabel}</span>
                <span className="text-sm font-normal text-primary-dark">
                  {COURIER_ONBOARDING_COPY.plateRequiredSub}
                </span>
              </label>
              <Input
                id="plate-input"
                type="text"
                placeholder={COURIER_ONBOARDING_COPY.platePlaceholder}
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                onBlur={() => setPlateTouched(true)}
                className="uppercase tracking-wider"
                aria-invalid={Boolean(plateError)}
                aria-describedby={plateError ? 'plate-error' : 'plate-help'}
              />
              {plateError ? (
                <span
                  id="plate-error"
                  className="text-sm font-medium text-destructive"
                  role="alert"
                >
                  {plateError}
                </span>
              ) : (
                <span id="plate-help" className="text-sm text-muted-foreground">
                  {COURIER_ONBOARDING_COPY.plateHelp}
                </span>
              )}
            </div>

            {/* Banner "Aparecé primero" */}
            <section className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-primary-dark" aria-hidden="true" />
                <h2 className="text-sm font-bold text-foreground">
                  {COURIER_ONBOARDING_COPY.appearFirstTitle}
                </h2>
              </div>
              <p className="text-sm leading-snug text-muted-foreground">
                {COURIER_ONBOARDING_COPY.appearFirstText}
              </p>
            </section>

            {/* Documentación opcional (Licencia y Seguro — solo moto/auto) */}
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-bold text-foreground">
                {COURIER_ONBOARDING_COPY.optionalDocsTitle}
              </h3>

              {OPTIONAL_DOCS.map((doc) => (
                <DocumentUploadCard
                  key={doc.kind}
                  kind={doc.kind}
                  title={doc.title}
                  subtitle={doc.subtitle}
                  icon={doc.icon}
                  status={optionalStatuses[doc.kind] || 'idle'}
                  compressing={compressingOptional[doc.kind]}
                  fileName={optionalFileNames[doc.kind]}
                  onFileSelected={(file) => void handleOptionalUpload(doc.kind, file)}
                />
              ))}
            </section>
          </>
        )}

        {/* Consentimientos obligatorios */}
        <section className="flex flex-col gap-3.5 pt-2">
          <h3 className="text-sm font-bold text-foreground">
            {COURIER_ONBOARDING_COPY.consentsTitle}
          </h3>

          <label className="flex min-h-[48px] cursor-pointer items-start gap-3 py-1">
            <input
              type="checkbox"
              checked={tosAccepted}
              onChange={(e) => setTosAccepted(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm leading-snug text-foreground">
              {COURIER_ONBOARDING_COPY.consentTosPrefix}{' '}
              <Link
                href="/legal/terms"
                onClick={(event) => event.stopPropagation()}
                className="rounded-sm font-medium text-primary-dark underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {COURIER_ONBOARDING_COPY.consentTosLink}
              </Link>
            </span>
          </label>

          <label className="flex min-h-[48px] cursor-pointer items-start gap-3 py-1">
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm leading-snug text-foreground">
              {COURIER_ONBOARDING_COPY.consentPrivacyPrefix}{' '}
              <Link
                href="/legal/privacy"
                onClick={(event) => event.stopPropagation()}
                className="rounded-sm font-medium text-primary-dark underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {COURIER_ONBOARDING_COPY.consentPrivacyLink}
              </Link>{' '}
              {COURIER_ONBOARDING_COPY.consentPrivacySuffix}
            </span>
          </label>

          <label className="flex min-h-[48px] cursor-pointer items-start gap-3 py-1">
            <input
              type="checkbox"
              checked={contractAccepted}
              onChange={(e) => setContractAccepted(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium leading-snug text-foreground">
              Acepto las{' '}
              <Link
                href="/legal/courier"
                onClick={(event) => event.stopPropagation()}
                className="rounded-sm text-primary-dark underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Condiciones para repartidores
              </Link>
              . {COURIER_ONBOARDING_COPY.consentContractText}
            </span>
          </label>
        </section>

        {/* Botón de envío */}
        <div className="flex flex-col items-center gap-2 pt-2">
          <Button
            type="submit"
            size="lg"
            disabled={!isFormValid || isSubmitting}
            className="w-full font-bold"
          >
            {isSubmitting ? (
              <>
                <RotateCw className="h-4 w-4" />
                <span>{COURIER_ONBOARDING_COPY.btnSubmitting}</span>
              </>
            ) : (
              <>
                <span>{COURIER_ONBOARDING_COPY.btnSubmitForReview}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </Button>
          <span className="text-sm text-muted-foreground">
            {COURIER_ONBOARDING_COPY.stepCounter2}
          </span>
        </div>
      </form>
    </Card>
  );
}
