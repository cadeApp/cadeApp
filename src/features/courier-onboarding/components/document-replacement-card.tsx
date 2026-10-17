'use client';

import * as React from 'react';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/ui/badge';
import { compressImage } from '@/lib/image-compression';
import { uploadCourierDocument, type CourierDocumentKind } from '../upload-manager';
import { replaceCourierDocumentAction } from '../actions';
import { COURIER_ONBOARDING_COPY, getSafeRejectionMessage } from '../copy';
import { DocumentUploadCard, type DocumentUploadStatus } from './document-upload-card';
import type { DocumentReviewStatus } from '../schemas';

export interface DocumentReplacementCardProps {
  courierId?: string;
  kind: CourierDocumentKind;
  title: string;
  initialStatus: DocumentReviewStatus;
  rejectionCode?: string | null;
  rejectionMessage?: string | null;
  onReplaced?: (result: { kind: CourierDocumentKind; status: DocumentReviewStatus }) => void;
}

/**
 * CC-025 / T-356: Componente común para reemplazar un documento rechazado del repartidor.
 * Se utiliza tanto en el perfil del repartidor (/courier/profile) como en la pantalla de estado (/courier/onboarding/status).
 * Muestra el estado «Rechazado / requiere corrección», el motivo seguro del catálogo público,
 * y un control de carga aislado para reintentar y promover mediante replaceCourierDocumentAction.
 */
export function DocumentReplacementCard({
  courierId,
  kind,
  title,
  initialStatus,
  rejectionCode,
  rejectionMessage,
  onReplaced,
}: DocumentReplacementCardProps) {
  const [currentStatus, setCurrentStatus] = React.useState<DocumentReviewStatus>(initialStatus);
  const [uploadStatus, setUploadStatus] = React.useState<DocumentUploadStatus>('idle');
  const [isCompressing, setIsCompressing] = React.useState(false);
  const [selectedFileName, setSelectedFileName] = React.useState<string | undefined>();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const safeReason = rejectionMessage || getSafeRejectionMessage(rejectionCode);

  const handleFileSelected = async (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSelectedFileName(file.name);
    setUploadStatus('uploading');
    setIsCompressing(true);

    try {
      // 1. Optimización / compresión de la imagen
      const compressed = await compressImage(file);
      setIsCompressing(false);

      // 2. Resolver courierId (prop o cliente de sesión)
      let resolvedCourierId = courierId;
      if (!resolvedCourierId) {
        const { createClient } = await import('@/lib/supabase/browser');
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          resolvedCourierId = user.id;
        }
      }

      if (!resolvedCourierId) {
        throw new Error('No se pudo identificar la sesión del repartidor');
      }

      // 3. Subida a Supabase Storage bucket 'courier-docs' con prefijo canónico courier/<uid>/<kind>_
      const { storagePath } = await uploadCourierDocument({
        courierId: resolvedCourierId,
        kind,
        file: compressed,
      });

      // 4. Invocación transaccional de la RPC replace_courier_document
      const idempotencyKey =
        typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined;
      const result = await replaceCourierDocumentAction({
        kind,
        storagePath,
        idempotencyKey,
      });

      if (!result.ok) {
        setUploadStatus('error');
        setErrorMessage(
          result.code === 'INVALID_STATE_TRANSITION'
            ? 'El documento ya no está en estado rechazado.'
            : 'Error al enviar el documento para revisión.'
        );
        return;
      }

      // 5. Transición de estado a 'submitted' («En revisión») SOLO tras confirmación persistida en DB
      setCurrentStatus('submitted');
      setUploadStatus('success');
      setSuccessMessage(COURIER_ONBOARDING_COPY.documentReplacedSuccess);
      onReplaced?.({ kind, status: 'submitted' });
    } catch (err) {
      setIsCompressing(false);
      setUploadStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Error inesperado al subir el archivo');
    }
  };

  // Si ya fue reemplazado exitosamente o se encuentra en revisión
  if (currentStatus === 'submitted') {
    return (
      <div
        data-slot="document-replacement-card"
        data-kind={kind}
        data-status="submitted"
        className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-medium text-foreground">{title}</span>
          </div>
          <Badge variant="declared" className="text-sm">
            {COURIER_ONBOARDING_COPY.underReviewBadge}
          </Badge>
        </div>
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {successMessage ?? COURIER_ONBOARDING_COPY.documentReplacedSuccess}
        </p>
      </div>
    );
  }

  if (currentStatus !== 'rejected') {
    return null;
  }

  return (
    <div
      data-slot="document-replacement-card"
      data-kind={kind}
      data-status="rejected"
      className="rounded-lg border border-destructive/30 bg-destructive/5 p-3.5 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="text-sm font-semibold text-foreground">{title}</span>
            <span className="sr-only">Observado</span>
          </div>
        </div>
        <Badge variant="destructive" className="text-sm shrink-0">
          {COURIER_ONBOARDING_COPY.rejectedBadge}
        </Badge>
      </div>

      <div className="rounded bg-background/80 p-2.5 border border-destructive/20 text-sm text-foreground">
        <p className="font-medium text-destructive">{safeReason}</p>
      </div>

      {errorMessage && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {errorMessage}
        </p>
      )}

      <DocumentUploadCard
        kind={kind}
        title={`Reemplazar ${title.toLowerCase()}`}
        subtitle="Seleccioná un archivo claro para enviar a nueva revisión"
        status={uploadStatus}
        compressing={isCompressing}
        fileName={selectedFileName}
        actionLabel={COURIER_ONBOARDING_COPY.btnReplace}
        onFileSelected={handleFileSelected}
      />
    </div>
  );
}
