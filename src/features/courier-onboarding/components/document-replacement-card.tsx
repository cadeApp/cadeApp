'use client';

import * as React from 'react';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/ui/badge';
import { compressImage } from '@/lib/image-compression';
import { uploadCourierDocument, type CourierDocumentKind } from '../upload-manager';
import { addCourierOptionalDocumentAction, replaceCourierDocumentAction } from '../actions';
import type { ActionResult, DomainErrorCode } from '@/domain/errors';
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
  /**
   * T-376 / CC-033: `replace` reemplaza un documento rechazado (`replace_courier_document`); `add` sube la licencia o el
   * seguro que no se cargaron en el onboarding (`add_courier_optional_document`) y se muestra solo con estado `none`.
   */
  mode?: 'replace' | 'add';
}

/** T-376: un mensaje por causa de falla del alta de un documento opcional. */
function addErrorMessage(code: DomainErrorCode): string {
  switch (code) {
    case 'INVALID_STATE_TRANSITION':
      return COURIER_ONBOARDING_COPY.optionalDocumentErrors.invalidState;
    case 'UNAUTHORIZED_ACTOR':
    case 'UNAUTHENTICATED':
      return COURIER_ONBOARDING_COPY.optionalDocumentErrors.unauthorized;
    case 'NOT_FOUND':
      return COURIER_ONBOARDING_COPY.optionalDocumentErrors.notFound;
    default:
      return COURIER_ONBOARDING_COPY.optionalDocumentErrors.generic;
  }
}

/**
 * CC-025 / T-356: Componente común para reemplazar un documento rechazado del repartidor.
 * Se utiliza tanto en el perfil del repartidor (/courier/profile) como en la pantalla de estado (/courier/onboarding/status).
 * Muestra el estado «Rechazado / requiere corrección», el motivo seguro del catálogo público,
 * y un control de carga aislado para reintentar y promover mediante replaceCourierDocumentAction.
 */
interface PendingAttempt {
  kind: CourierDocumentKind;
  fingerprint: string;
  idempotencyKey: string;
  timestamp: number;
  storagePath: string;
  uploadConfirmed: boolean;
}

export function DocumentReplacementCard({
  courierId,
  kind,
  title,
  initialStatus,
  rejectionCode,
  rejectionMessage,
  onReplaced,
  mode = 'replace',
}: DocumentReplacementCardProps) {
  const [currentStatus, setCurrentStatus] = React.useState<DocumentReviewStatus>(initialStatus);
  const [uploadStatus, setUploadStatus] = React.useState<DocumentUploadStatus>('idle');
  const [isCompressing, setIsCompressing] = React.useState(false);
  const [selectedFileName, setSelectedFileName] = React.useState<string | undefined>();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  // PR358-R01: Conservar intento lógico para reintentos idempotentes sin resubida ni cambio de clave
  const pendingAttemptRef = React.useRef<PendingAttempt | null>(null);

  const safeReason = rejectionMessage || getSafeRejectionMessage(rejectionCode);

  const handleFileSelected = async (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSelectedFileName(file.name);
    // Identificador único del archivo seleccionado (nombre, tamaño, tipo y última modificación)
    const fingerprint = `${file.name}-${file.size}-${file.type}-${file.lastModified}`;
    const previousAttempt = pendingAttemptRef.current;
    const isSameAttempt =
      previousAttempt !== null &&
      previousAttempt.kind === kind &&
      previousAttempt.fingerprint === fingerprint;

    let idempotencyKey: string;
    if (isSameAttempt) {
      idempotencyKey = previousAttempt.idempotencyKey;
    } else {
      try {
        if (typeof globalThis.crypto?.randomUUID !== 'function') {
          throw new Error('Entorno criptográfico no disponible');
        }
        idempotencyKey = globalThis.crypto.randomUUID();
      } catch {
        setUploadStatus('error');
        setErrorMessage('No se pudo generar un identificador seguro para la operación');
        return;
      }
    }

    setUploadStatus('uploading');

    const attempt: PendingAttempt = isSameAttempt
      ? previousAttempt
      : {
          kind,
          fingerprint,
          idempotencyKey,
          timestamp: Date.now(),
          storagePath: '',
          uploadConfirmed: false,
        };
    pendingAttemptRef.current = attempt;

    try {
      // 1. Resolver courierId (prop o cliente de sesión)
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

      // 2. Subida a Supabase Storage SOLO si no fue confirmada previamente para este intento (PR358-R01)
      if (!attempt.uploadConfirmed) {
        setIsCompressing(true);
        const compressed = await compressImage(file);
        setIsCompressing(false);

        const { storagePath } = await uploadCourierDocument({
          courierId: resolvedCourierId,
          kind,
          file: compressed,
          timestamp: attempt.timestamp,
        });

        attempt.storagePath = storagePath;
        attempt.uploadConfirmed = true;
      }

      // 3. Invocación transaccional de la RPC con la clave e intento estables (reemplazo o alta, según el modo)
      const submission = {
        kind,
        storagePath: attempt.storagePath,
        idempotencyKey: attempt.idempotencyKey,
      };
      let result: ActionResult<{ status: DocumentReviewStatus }, DomainErrorCode>;
      if (mode === 'add') {
        try {
          result = await addCourierOptionalDocumentAction(submission);
        } catch {
          // Sin respuesta del servidor: el mismo intento (clave y archivo ya subido) se puede reintentar.
          setUploadStatus('error');
          setErrorMessage(COURIER_ONBOARDING_COPY.optionalDocumentErrors.network);
          return;
        }
      } else {
        result = await replaceCourierDocumentAction(submission);
      }

      if (!result.ok) {
        setUploadStatus('error');
        setErrorMessage(
          mode === 'add'
            ? addErrorMessage(result.code)
            : result.code === 'INVALID_STATE_TRANSITION'
              ? 'El documento ya no está en estado rechazado.'
              : 'Error al enviar el documento para revisión.'
        );
        return;
      }

      // 4. Consumir el estado autoritativo retornado por la RPC ('verified' o 'submitted') (PR358-R01)
      const authoritativeStatus: DocumentReviewStatus =
        result.data?.status === 'verified' ? 'verified' : 'submitted';

      setCurrentStatus(authoritativeStatus);
      setUploadStatus('success');
      setSuccessMessage(
        authoritativeStatus === 'verified'
          ? 'Documento validado exitosamente.'
          : mode === 'add'
            ? COURIER_ONBOARDING_COPY.optionalDocumentSubmitted
            : COURIER_ONBOARDING_COPY.documentReplacedSuccess
      );
      onReplaced?.({ kind, status: authoritativeStatus });
    } catch (err) {
      setIsCompressing(false);
      setUploadStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Error inesperado al subir el archivo');
    }
  };

  // Si ya fue validado por admin
  if (currentStatus === 'verified') {
    return (
      <div
        data-slot="document-replacement-card"
        data-kind={kind}
        data-status="verified"
        className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
            <span className="text-sm font-medium text-foreground">{title}</span>
          </div>
          <Badge variant="verified" className="text-sm">
            Validado por admin
          </Badge>
        </div>
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {successMessage ?? 'Documento validado exitosamente.'}
        </p>
      </div>
    );
  }

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

  if (mode === 'add') {
    if (currentStatus !== 'none') {
      return null;
    }
    return (
      <div
        data-slot="document-replacement-card"
        data-kind={kind}
        data-status="none"
        className="rounded-lg border border-border/60 bg-muted/20 p-3.5 space-y-3"
      >
        <p className="text-sm text-muted-foreground">{COURIER_ONBOARDING_COPY.optionalDocumentHint}</p>

        {errorMessage && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {errorMessage}
          </p>
        )}

        <DocumentUploadCard
          kind={kind}
          title={COURIER_ONBOARDING_COPY.optionalDocumentAddTitle(title)}
          subtitle={COURIER_ONBOARDING_COPY.optionalDocumentSubtitle}
          status={uploadStatus}
          compressing={isCompressing}
          fileName={selectedFileName}
          onFileSelected={handleFileSelected}
        />
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
