'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Camera, CheckCircle2, RotateCw, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Card } from '@/ui/card';
import { compressImage } from '@/lib/image-compression';
import { COURIER_ONBOARDING_COPY } from '../copy';
import { StepIndicator } from './step-indicator';
import {
  type CourierDocumentKind,
  createDocumentUploadManager,
  uploadCourierDocument,
} from '../upload-manager';

export interface IdentityFormProps {
  courierId?: string;
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

export function IdentityForm({ courierId = 'temp-courier-id', initialDni = '', onNext }: IdentityFormProps) {
  const router = useRouter();
  const [dni, setDni] = React.useState(initialDni);
  const [dniTouched, setDniTouched] = React.useState(false);
  const [compressing, setCompressing] = React.useState<Partial<Record<CourierDocumentKind, boolean>>>({});
  const [uploadedPaths, setUploadedPaths] = React.useState<Partial<Record<CourierDocumentKind, string>>>({});
  const [statuses, setStatuses] = React.useState<Partial<Record<CourierDocumentKind, 'idle' | 'uploading' | 'success' | 'error'>>>({});
  const [fileNames, setFileNames] = React.useState<Partial<Record<CourierDocumentKind, string>>>({});

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
        const initialStatuses: Partial<Record<CourierDocumentKind, 'idle' | 'uploading' | 'success' | 'error'>> = {};
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
      router.push('/onboarding/vehicle');
    }
  };

  return (
    <div className="w-full max-w-[390px] mx-auto min-h-screen flex flex-col bg-background pb-28">
      <StepIndicator currentStep={2} />

      <main className="flex-1 px-4 pt-4 flex flex-col gap-5">
        {/* Banner de seguridad y confianza */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 flex items-start gap-3 relative overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-foreground mb-0.5">
              {COURIER_ONBOARDING_COPY.securityBannerTitle}
            </h2>
            <p className="text-sm text-muted-foreground leading-snug">
              {COURIER_ONBOARDING_COPY.securityBannerText}
            </p>
          </div>
        </div>

        {/* Input de DNI numérico */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dni-input" className="text-sm font-semibold text-foreground">
            {COURIER_ONBOARDING_COPY.dniLabel} <span className="text-primary">*</span>
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
            className="h-12 text-sm bg-card"
            aria-invalid={Boolean(dniError)}
            aria-describedby={dniError ? 'dni-error' : 'dni-help'}
          />
          {dniError ? (
            <span id="dni-error" className="text-sm text-destructive font-medium" role="alert">
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
            <span className="text-sm text-muted-foreground font-medium">
              {COURIER_ONBOARDING_COPY.documentsSubtitle(uploadedCount, REQUIRED_DOCS.length)}
            </span>
          </div>

          {REQUIRED_DOCS.map((doc) => {
            const status = statuses[doc.kind] || 'idle';
            const isCompress = compressing[doc.kind];
            const fileName = fileNames[doc.kind];

            return (
              <Card
                key={doc.kind}
                className={`p-3.5 transition-colors relative ${
                  status === 'success'
                    ? 'border-border bg-card'
                    : status === 'error'
                    ? 'border-destructive bg-destructive/5'
                    : 'border-2 border-dashed border-primary/40 bg-card hover:bg-primary/5'
                }`}
              >
                <label
                  htmlFor={`file-input-${doc.kind}`}
                  className="flex items-center justify-between gap-3 min-h-[56px] cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${
                        status === 'success'
                          ? 'bg-success/15 text-success'
                          : status === 'error'
                          ? 'bg-destructive/15 text-destructive'
                          : 'bg-primary/15 text-primary'
                      }`}
                    >
                      {status === 'success' ? (
                        <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                      ) : status === 'error' ? (
                        <AlertCircle className="h-6 w-6" aria-hidden="true" />
                      ) : (
                        <Camera className="h-6 w-6" aria-hidden="true" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-foreground truncate">{doc.title}</span>
                      <span className="text-sm text-muted-foreground truncate">
                        {status === 'success' && fileName
                          ? fileName
                          : isCompress
                          ? COURIER_ONBOARDING_COPY.btnCompressing
                          : status === 'uploading'
                          ? COURIER_ONBOARDING_COPY.btnUploading
                          : status === 'error'
                          ? 'Error al subir. Tocá para reintentar.'
                          : doc.subtitle}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {status === 'success' ? (
                      <span className="text-sm font-semibold text-success flex items-center gap-1">
                        {COURIER_ONBOARDING_COPY.btnUploaded}
                      </span>
                    ) : status === 'uploading' || isCompress ? (
                      <RotateCw className="h-5 w-5 animate-spin text-primary" aria-label="Cargando" />
                    ) : status === 'error' ? (
                      <span className="text-sm font-semibold text-destructive">
                        {COURIER_ONBOARDING_COPY.btnRetry}
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-primary">
                        {COURIER_ONBOARDING_COPY.btnUpload}
                      </span>
                    )}
                  </div>
                </label>
                <input
                  id={`file-input-${doc.kind}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    void handleFileChange(doc.kind, file);
                  }}
                  disabled={status === 'uploading' || isCompress}
                />
              </Card>
            );
          })}
        </section>

        {/* Tip de compresión y formatos */}
        <div className="p-3 bg-card border border-border/60 rounded-lg text-muted-foreground text-sm leading-snug">
          {COURIER_ONBOARDING_COPY.acceptedFormatsTip}
        </div>
      </main>

      {/* Botón flotante inferior */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-background/95 backdrop-blur-sm border-t border-border/40 px-4 py-3 z-30 flex flex-col items-center gap-1.5">
        <Button
          type="button"
          onClick={handleContinue}
          disabled={!isFormComplete}
          className="w-full h-12 text-sm font-bold flex items-center justify-center gap-2"
        >
          <span>{COURIER_ONBOARDING_COPY.btnContinue}</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
        <span className="text-sm text-muted-foreground">{COURIER_ONBOARDING_COPY.stepCounter1}</span>
      </div>
    </div>
  );
}
