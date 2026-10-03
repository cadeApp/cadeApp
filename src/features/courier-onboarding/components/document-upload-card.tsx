'use client';

import * as React from 'react';
import { AlertCircle, Camera, CheckCircle2, RotateCw, type LucideIcon } from 'lucide-react';
import { Card } from '@/ui/card';
import { COURIER_ONBOARDING_COPY } from '../copy';
import type { CourierDocumentKind } from '../upload-manager';

export type DocumentUploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export interface DocumentUploadCardProps {
  kind: CourierDocumentKind;
  title: string;
  subtitle: string;
  status: DocumentUploadStatus;
  /** La imagen se está optimizando antes de subir (parte del estado `uploading`). */
  compressing?: boolean;
  fileName?: string;
  /** Ícono del estado idle; éxito y error usan siempre los mismos íconos. */
  icon?: LucideIcon;
  onFileSelected: (file: File) => void;
}

/**
 * Tarjeta de subida de un documento del onboarding del repartidor (T-325). La usan el paso 2 (DNI, selfie y
 * avatar) y el paso 3 (licencia y seguro), para que los dos comuniquen igual idle, optimizando/subiendo,
 * cargado, error y reintento.
 */
export function DocumentUploadCard({
  kind,
  title,
  subtitle,
  status,
  compressing = false,
  fileName,
  icon: IdleIcon = Camera,
  onFileSelected,
}: DocumentUploadCardProps) {
  const inputId = `file-input-${kind}`;
  const statusId = `${inputId}-status`;
  const busy = status === 'uploading' || compressing;

  const statusText =
    status === 'success' && fileName
      ? fileName
      : compressing
        ? COURIER_ONBOARDING_COPY.btnCompressing
        : status === 'uploading'
          ? COURIER_ONBOARDING_COPY.btnUploading
          : status === 'error'
            ? COURIER_ONBOARDING_COPY.uploadErrorRetry
            : subtitle;

  return (
    <Card
      data-slot="document-upload-card"
      data-status={status}
      aria-busy={busy}
      className={`relative p-3.5 transition-colors ${
        status === 'success'
          ? 'border-border bg-card'
          : status === 'error'
            ? 'border-destructive bg-destructive/5'
            : 'border-2 border-dashed border-primary/40 bg-card hover:bg-primary/5'
      }`}
    >
      <label
        htmlFor={inputId}
        className="flex min-h-[56px] cursor-pointer items-center justify-between gap-3"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
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
              <IdleIcon className="h-6 w-6" aria-hidden="true" />
            )}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">{title}</span>
            <span
              id={statusId}
              role={status === 'error' ? 'alert' : 'status'}
              className="truncate text-sm text-muted-foreground"
            >
              {statusText}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {status === 'success' ? (
            <span className="text-success flex items-center gap-1 text-sm font-semibold">
              {COURIER_ONBOARDING_COPY.btnUploaded}
            </span>
          ) : busy ? (
            <RotateCw className="h-5 w-5 text-primary" aria-hidden="true" />
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
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-describedby={statusId}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Limpiar el valor permite reintentar con el mismo archivo después de un error.
          e.target.value = '';
          if (file) onFileSelected(file);
        }}
        disabled={busy}
      />
    </Card>
  );
}
