'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Card } from '@/ui/card';
import { compressImage } from '@/lib/image-compression';
import { COURIER_ONBOARDING_COPY } from '../copy';
import { StepIndicator } from './step-indicator';
import { DocumentUploadCard, type DocumentUploadStatus } from './document-upload-card';
import {
  type CourierDocumentKind,
  createDocumentUploadManager,
  uploadCourierDocument,
} from '../upload-manager';

export interface IdentityFormProps {
  courierId: string;
  initialDni?: string;
  onNext?: (data: { dni: string; documents: Record<CourierDocumentKind, string> }) => void;
}

interface DocConfig {
  kind: CourierDocumentKind;
  title: string;
  subtitle: string;
}

const REQUIRED_DOCS: DocConfig[] = [
  {
    kind: 'dni_front',
    title: COURIER_ONBOARDING_COPY.dniFrontTitle,
    subtitle: COURIER_ONBOARDING_COPY.dniFrontSubtitle,
  },
  {
    kind: 'dni_back',
    title: COURIER_ONBOARDING_COPY.dniBackTitle,
    subtitle: COURIER_ONBOARDING_COPY.dniBackSubtitle,
  },
  {
    kind: 'selfie',
    title: COURIER_ONBOARDING_COPY.selfieTitle,
    subtitle: COURIER_ONBOARDING_COPY.selfieSubtitle,
  },
  {
    kind: 'avatar',
    title: COURIER_ONBOARDING_COPY.avatarTitle,
    subtitle: COURIER_ONBOARDING_COPY.avatarSubtitle,
  },
];

export function IdentityForm({ courierId, initialDni = '', onNext }: IdentityFormProps) {
  const router = useRouter();
  const [dni, setDni] = React.useState(initialDni);
  const [dniTouched, setDniTouched] = React.useState(false);
  const [compressing, setCompressing] = React.useState<
    Partial<Record<CourierDocumentKind, boolean>>
  >({});
  const [uploadedPaths, setUploadedPaths] = React.useState<
    Partial<Record<CourierDocumentKind, string>>
  >({});
  const [statuses, setStatuses] = React.useState<
    Partial<Record<CourierDocumentKind, DocumentUploadStatus>>
  >({});
  const [fileNames, setFileNames] = React.useState<Partial<Record<CourierDocumentKind, string>>>(
    {}
  );

  // Cargar estado previo de sessionStorage si existe
  React.useEffect(() => {
    try {
      const savedDni = sessionStorage.getItem('cadeapp_onboarding_dni');
      const savedDocs = sessionStorage.getItem('cadeapp_onboarding_docs');
      if (savedDni && !initialDni) {
        setDni(savedDni);
      }
      if (savedDocs) {
        const parsed = JSON.parse(savedDocs);
        setUploadedPaths(parsed);
        const initialStatuses: Partial<Record<CourierDocumentKind, DocumentUploadStatus>> = {};
        for (const k of Object.keys(parsed) as CourierDocumentKind[]) {
          initialStatuses[k] = 'success';
        }
        setStatuses(initialStatuses);
      }
    } catch {
      // Ignorar errores de lectura de sessionStorage
    }
  }, [initialDni]);

  const normalizedDni = dni.replace(/\D/g, '');
  const isDniValid = normalizedDni.length >= 7 && normalizedDni.length <= 8;
  const dniError = dniTouched && !isDniValid ? 'El DNI debe tener 7 u 8 dígitos numéricos' : null;

  const uploadedCount = REQUIRED_DOCS.filter((d) => statuses[d.kind] === 'success').length;
  const isFormComplete = isDniValid && uploadedCount === REQUIRED_DOCS.length;

  const handleFileChange = async (kind: CourierDocumentKind, file: File | null) => {
    if (!file) return;

    setFileNames((prev) => ({ ...prev, [kind]: file.name }));
    setCompressing((prev) => ({ ...prev, [kind]: true }));
    setStatuses((prev) => ({ ...prev, [kind]: 'uploading' }));

    try {
      // 1. Compresión client-side nativa
      const compressed = await compressImage(file);
      setCompressing((prev) => ({ ...prev, [kind]: false }));

      // 2. Subida individual al bucket courier-docs
      const result = await uploadCourierDocument({ courierId, kind, file: compressed });
      setUploadedPaths((prev) => {
        const next = { ...prev, [kind]: result.storagePath };
        try {
          sessionStorage.setItem('cadeapp_onboarding_docs', JSON.stringify(next));
        } catch {}
        return next;
      });
      setStatuses((prev) => ({ ...prev, [kind]: 'success' }));
    } catch {
      setCompressing((prev) => ({ ...prev, [kind]: false }));
      setStatuses((prev) => ({ ...prev, [kind]: 'error' }));
    }
  };

  const handleContinue = () => {
    if (!isFormComplete) return;

    try {
      sessionStorage.setItem('cadeapp_onboarding_dni', normalizedDni);
      sessionStorage.setItem('cadeapp_onboarding_docs', JSON.stringify(uploadedPaths));
    } catch {}

    if (onNext) {
      onNext({
        dni: normalizedDni,
        documents: uploadedPaths as Record<CourierDocumentKind, string>,
      });
    } else {
      router.push('/courier/onboarding/vehicle');
    }
  };

  return (
    <Card className="mx-auto w-full max-w-lg overflow-hidden">
      <StepIndicator currentStep={2} />

      <div className="flex flex-col gap-5 p-6 sm:p-8">
        {/* Banner de seguridad y confianza */}
        <div className="relative flex items-start gap-3 overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-3.5">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 className="mb-0.5 text-sm font-semibold text-foreground">
              {COURIER_ONBOARDING_COPY.securityBannerTitle}
            </h2>
            <p className="text-sm leading-snug text-muted-foreground">
              {COURIER_ONBOARDING_COPY.securityBannerText}
            </p>
          </div>
        </div>

        {/* Input de DNI numérico */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dni-input" className="text-sm font-semibold text-foreground">
            {COURIER_ONBOARDING_COPY.dniLabel} <span className="text-primary-dark">*</span>
          </label>
          <Input
            id="dni-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder={COURIER_ONBOARDING_COPY.dniPlaceholder}
            value={dni}
            onChange={(e) => {
              setDni(e.target.value);
              try {
                sessionStorage.setItem('cadeapp_onboarding_dni', e.target.value.replace(/\D/g, ''));
              } catch {}
            }}
            onBlur={() => setDniTouched(true)}
            aria-invalid={Boolean(dniError)}
            aria-describedby={dniError ? 'dni-error' : 'dni-help'}
          />
          {dniError ? (
            <span id="dni-error" className="text-sm font-medium text-destructive" role="alert">
              {dniError}
            </span>
          ) : (
            <span id="dni-help" className="text-sm text-muted-foreground">
              {COURIER_ONBOARDING_COPY.dniHelp}
            </span>
          )}
        </div>

        {/* Sección Documentación Personal */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">
              {COURIER_ONBOARDING_COPY.documentsTitle}
            </h3>
            <span className="text-sm font-medium text-muted-foreground">
              {COURIER_ONBOARDING_COPY.documentsSubtitle(uploadedCount, REQUIRED_DOCS.length)}
            </span>
          </div>

          {REQUIRED_DOCS.map((doc) => (
            <DocumentUploadCard
              key={doc.kind}
              kind={doc.kind}
              title={doc.title}
              subtitle={doc.subtitle}
              status={statuses[doc.kind] || 'idle'}
              compressing={compressing[doc.kind]}
              fileName={fileNames[doc.kind]}
              onFileSelected={(file) => void handleFileChange(doc.kind, file)}
            />
          ))}
        </section>

        {/* Tip de compresión y formatos */}
        <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm leading-snug text-muted-foreground">
          {COURIER_ONBOARDING_COPY.acceptedFormatsTip}
        </div>

        {/* Botón de acción inferior */}
        <div className="flex flex-col items-center gap-2 pt-2">
          <Button
            type="button"
            size="lg"
            onClick={handleContinue}
            disabled={!isFormComplete}
            className="w-full font-bold"
          >
            <span>{COURIER_ONBOARDING_COPY.btnContinue}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {COURIER_ONBOARDING_COPY.stepCounter1}
          </span>
        </div>
      </div>
    </Card>
  );
}
