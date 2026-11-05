'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/ui/tabs';
import { Textarea } from '@/ui/textarea';
import { notify } from '@/ui/notify';
import { cn } from '@/ui/cn';
import { formatDate } from '@/lib/format';
import { getDomainErrorMessage } from '@/lib/error-messages';
import type { DomainErrorCode } from '@/domain/errors';
import {
  viewCourierDocumentAction,
  decideCourierAction,
  rejectCourierAction,
  reinstateCourierAction,
  suspendCourierAction,
  verifyCourierDocumentAction,
} from '../actions';
import {
  APPLICANT_REJECTION_OPTIONS,
  decisionFormSchema,
  rejectApplicantFormSchema,
  rejectDocumentFormSchema,
  type DecisionFormInput,
  type RejectApplicantFormInput,
  type RejectDocumentFormInput,
} from '../schemas';
import { ADMIN_COPY } from '../copy';
import type { ApplicantDetail, ApplicantDocumentDetail, DocumentContentType } from '../types';
import { ApplicantHistory } from './applicant-history';

interface ApplicantDetailViewProps {
  readonly applicant: ApplicantDetail;
}

type DecisionModal = 'approved' | 'suspended' | 'reactivate' | 'reconsider';

/** El texto genérico de INVALID_STATE_TRANSITION habla de pedidos; acá el estado es el del repartidor. */
function courierDecisionErrorMessage(code: DomainErrorCode): string {
  return code === 'INVALID_STATE_TRANSITION'
    ? ADMIN_COPY.detail.errors.invalidCourierTransition
    : getDomainErrorMessage(code);
}

const ROTATION_CLASSES: Record<number, string> = {
  0: 'rotate-0',
  90: 'rotate-90',
  180: 'rotate-180',
  270: '-rotate-90',
};

const ZOOM_CLASSES: Record<number, string> = {
  0: 'scale-75',
  1: 'scale-100',
  2: 'scale-125',
  3: 'scale-150',
};

export function ApplicantDetailView({ applicant }: ApplicantDetailViewProps) {
  const router = useRouter();

  // Selección de documento actual mediante Tabs
  const [selectedDocId, setSelectedDocId] = React.useState<string>(
    applicant.documents[0]?.id ?? ''
  );
  const currentDoc: ApplicantDocumentDetail | undefined = applicant.documents.find(
    (d) => d.id === selectedDocId
  );

  // Estado del visor documental
  const [signedUrl, setSignedUrl] = React.useState<string | null>(null);
  const [contentType, setContentType] = React.useState<DocumentContentType>('image');
  const [expiresIn, setExpiresIn] = React.useState<number>(0);
  const [loadingDoc, setLoadingDoc] = React.useState(false);
  const [zoomLevel, setZoomLevel] = React.useState(1);
  const [rotation, setRotation] = React.useState<0 | 90 | 180 | 270>(0);

  // Diálogo y formulario de decisión global sobre el postulante
  const [decisionModal, setDecisionModal] = React.useState<DecisionModal | null>(null);
  const [decisionError, setDecisionError] = React.useState<string | null>(null);
  // Doble clic: el segundo envío se descarta mientras el primero sigue en curso.
  const decisionInFlight = React.useRef(false);

  const decisionForm = useForm<DecisionFormInput>({
    resolver: zodResolver(decisionFormSchema),
    defaultValues: { reason: '' },
  });

  // T-404 (A02-rechazar): rechazo con motivo de lista y mensaje para el postulante.
  const [rejectApplicantOpen, setRejectApplicantOpen] = React.useState(false);
  const rejectApplicantForm = useForm<RejectApplicantFormInput>({
    resolver: zodResolver(rejectApplicantFormSchema),
    defaultValues: { message: '' },
  });
  const rejectOption = rejectApplicantForm.watch('option');

  // Diálogo y formulario de rechazo documental específico
  const [rejectDocDialogOpen, setRejectDocDialogOpen] = React.useState(false);
  const rejectDocTriggerRef = React.useRef<HTMLButtonElement>(null);

  const rejectDocForm = useForm<RejectDocumentFormInput>({
    resolver: zodResolver(rejectDocumentFormSchema),
    defaultValues: { rejectionReason: '' },
  });

  function closeRejectDocDialog() {
    setRejectDocDialogOpen(false);
    rejectDocForm.reset();
    queueMicrotask(() => {
      rejectDocTriggerRef.current?.focus();
    });
  }

  // Verificación de documento individual (aprobación)
  const [verifyingDoc, setVerifyingDoc] = React.useState(false);

  // Reset del visor al cambiar de documento
  React.useEffect(() => {
    setSignedUrl(null);
    setContentType('image');
    setExpiresIn(0);
    setZoomLevel(1);
    setRotation(0);
  }, [selectedDocId]);

  // Temporizador de cuenta regresiva para la URL firmada (60s)
  React.useEffect(() => {
    if (expiresIn <= 0) return;
    const interval = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 1) {
          setSignedUrl(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresIn]);

  async function handleLoadDocument() {
    if (!currentDoc) return;
    setLoadingDoc(true);
    try {
      const res = await viewCourierDocumentAction({
        documentId: currentDoc.id,
        courierId: applicant.id,
      });

      if (!res.ok) {
        notify.error(getDomainErrorMessage(res.code));
        return;
      }

      setSignedUrl(res.data.signedUrl);
      setContentType(res.data.contentType);
      setExpiresIn(res.data.expiresInSeconds);
      notify.success(ADMIN_COPY.detail.success.documentLoaded);
    } catch {
      notify.error(ADMIN_COPY.detail.errors.loadDocumentConnection);
    } finally {
      setLoadingDoc(false);
    }
  }

  async function handleApproveDocument() {
    if (!currentDoc) return;
    setVerifyingDoc(true);
    try {
      const res = await verifyCourierDocumentAction({
        documentId: currentDoc.id,
        verified: true,
        rejectionReason: null,
      });

      if (!res.ok) {
        notify.error(getDomainErrorMessage(res.code));
        return;
      }

      notify.success(ADMIN_COPY.detail.success.documentVerified);
      router.refresh();
    } catch {
      notify.error(ADMIN_COPY.detail.errors.verifyDocumentConnection);
    } finally {
      setVerifyingDoc(false);
    }
  }

  const onRejectDocSubmit = rejectDocForm.handleSubmit(async (data) => {
    if (!currentDoc) return;
    try {
      const res = await verifyCourierDocumentAction({
        documentId: currentDoc.id,
        verified: false,
        rejectionReason: data.rejectionReason,
      });

      if (!res.ok) {
        notify.error(getDomainErrorMessage(res.code));
        return;
      }

      notify.success(ADMIN_COPY.detail.success.documentRejected);
      closeRejectDocDialog();
      router.refresh();
    } catch {
      notify.error(ADMIN_COPY.detail.errors.verifyDocumentConnection);
    }
  });

  function openDecisionModal(modal: DecisionModal) {
    setDecisionError(null);
    setDecisionModal(modal);
  }

  function closeDecisionModal() {
    setDecisionModal(null);
    setDecisionError(null);
    decisionForm.reset();
  }

  function showDecisionError(message: string) {
    setDecisionError(message);
    notify.error(message);
  }

  const onDecisionSubmit = decisionForm.handleSubmit(async (data) => {
    if (!decisionModal || decisionInFlight.current) return;
    decisionInFlight.current = true;
    setDecisionError(null);

    try {
      if (decisionModal === 'suspended') {
        const res = await suspendCourierAction({
          courierId: applicant.id,
          reason: data.reason,
        });
        if (!res.ok) {
          showDecisionError(courierDecisionErrorMessage(res.code));
          return;
        }
        notify.success(ADMIN_COPY.detail.success.courierSuspended);
      } else if (decisionModal === 'reactivate' || decisionModal === 'reconsider') {
        const res = await reinstateCourierAction({
          courierId: applicant.id,
          reason: data.reason,
        });
        if (!res.ok) {
          showDecisionError(courierDecisionErrorMessage(res.code));
          return;
        }
        notify.success(
          res.data.idempotent
            ? ADMIN_COPY.detail.success.courierAlreadyApproved
            : ADMIN_COPY.detail.success.courierReinstated
        );
      } else {
        const res = await decideCourierAction({
          courierId: applicant.id,
          decision: decisionModal,
          reason: data.reason,
        });
        if (!res.ok) {
          showDecisionError(courierDecisionErrorMessage(res.code));
          return;
        }
        notify.success(
          decisionModal === 'approved'
            ? ADMIN_COPY.detail.success.applicantApproved
            : ADMIN_COPY.detail.success.applicantRejected
        );
      }

      closeDecisionModal();
      router.refresh();
    } catch {
      showDecisionError(ADMIN_COPY.detail.errors.decisionConnection);
    } finally {
      decisionInFlight.current = false;
    }
  });

  function closeRejectApplicant() {
    setRejectApplicantOpen(false);
    setDecisionError(null);
    rejectApplicantForm.reset({ message: '' });
  }

  const onRejectApplicantSubmit = rejectApplicantForm.handleSubmit(async (data) => {
    if (decisionInFlight.current) return;
    decisionInFlight.current = true;
    setDecisionError(null);
    try {
      const res = await rejectCourierAction({ courierId: applicant.id, option: data.option, message: data.message });
      if (!res.ok) {
        showDecisionError(courierDecisionErrorMessage(res.code));
        return;
      }
      notify.success(ADMIN_COPY.detail.success.applicantRejected);
      closeRejectApplicant();
      router.refresh();
    } catch {
      showDecisionError(ADMIN_COPY.detail.errors.decisionConnection);
    } finally {
      decisionInFlight.current = false;
    }
  });

  return (
    <div className="space-y-6">
      {/* Navegación de regreso */}
      <div className="flex items-center gap-2">
        <Link
          href="/admin/applicants"
          className="text-sm font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {ADMIN_COPY.detail.backToList}
        </Link>
      </div>

      {/* Encabezado */}
      <div className="border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{applicant.fullName}</h1>
          <Badge
            variant={
              applicant.status === 'approved'
                ? 'default'
                : applicant.status === 'rejected' || applicant.status === 'suspended'
                ? 'destructive'
                : 'secondary'
            }
          >
            {ADMIN_COPY.applicantStatus[applicant.status]}
          </Badge>
        </div>
        <p className="mt-1 text-sm font-medium text-foreground">
          {applicant.hasDni ? ADMIN_COPY.queue.dniLoaded : ADMIN_COPY.queue.dniPending}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Columna izquierda (60 %): aviso de auditoría y visor actual */}
      <div className="space-y-4 lg:col-span-3">
      <div className="rounded-lg border badge-warning p-4 text-sm shadow-sm flex items-center gap-3" role="note">
        <svg
          className="h-5 w-5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
        <span className="font-semibold">{ADMIN_COPY.detail.viewerAuditNotice}</span>
      </div>

      {/* Tabs oficiales de documentos y visor A02 */}
      <Tabs
        value={selectedDocId}
        onValueChange={setSelectedDocId}
        orientation="vertical"
        className="w-full"
      >
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Selector lateral oficial de documentos con TabsList */}
          <Card className="xl:col-span-1 border border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                {ADMIN_COPY.detail.documentationTitle(applicant.documents.length)}
              </CardTitle>
              <CardDescription className="text-sm">
                {ADMIN_COPY.detail.documentationDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2">
              <TabsList
                className="flex flex-col h-auto w-full bg-transparent p-0 gap-1"
                aria-label={ADMIN_COPY.detail.documentsAriaLabel}
              >
                {applicant.documents.map((doc) => (
                  <TabsTrigger
                    key={doc.id}
                    value={doc.id}
                    className="w-full justify-between p-3 rounded-md text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-medium text-left"
                  >
                    <span className="truncate">
                      {ADMIN_COPY.documentKind[doc.documentType]}
                      {doc.isCurrent === false && ' (Histórico)'}
                    </span>
                    <span className="text-sm shrink-0 ml-2">
                      {doc.isCurrent === false
                        ? '↺'
                        : doc.status === 'verified'
                        ? '✓'
                        : doc.status === 'rejected'
                        ? '✕'
                        : '•'}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </CardContent>
          </Card>

          {/* Panel central del visor con TabsContent */}
          <div className="xl:col-span-3">
            {applicant.documents.length === 0 ? (
              <Card className="border border-border shadow-sm">
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  {ADMIN_COPY.detail.emptyDocuments}
                </CardContent>
              </Card>
            ) : (
              applicant.documents.map((doc) => {
                const isSelected = doc.id === selectedDocId;
                return (
                  <TabsContent key={doc.id} value={doc.id} className="mt-0">
                    <Card className="border border-border shadow-sm flex flex-col">
                      <CardHeader className="flex flex-row items-center justify-between border-b border-border py-3">
                        <div>
                          <CardTitle className="text-base font-semibold">
                            {ADMIN_COPY.documentKind[doc.documentType]}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {ADMIN_COPY.detail.labels.state}:{' '}
                            <span className="font-medium text-foreground">
                              {ADMIN_COPY.documentStatus[doc.status]}
                            </span>{' '}
                            · {ADMIN_COPY.detail.labels.uploadedAt} {formatDate(doc.uploadedAt, 'dateTime')}
                          </CardDescription>
                        </div>

                        {/* Controles de visor de documento (zoom y rotación solo aplican a fotos) */}
                        {isSelected && signedUrl && contentType === 'image' ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setZoomLevel((z) => Math.max(0, z - 1))}
                              aria-label={ADMIN_COPY.detail.viewer.zoomOut}
                              title={ADMIN_COPY.detail.viewer.zoomOut}
                            >
                              -
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setZoomLevel((z) => Math.min(3, z + 1))}
                              aria-label={ADMIN_COPY.detail.viewer.zoomIn}
                              title={ADMIN_COPY.detail.viewer.zoomIn}
                            >
                              +
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setRotation(
                                  (r) => ((r + 90) % 360) as 0 | 90 | 180 | 270
                                )
                              }
                              aria-label={ADMIN_COPY.detail.viewer.rotate}
                              title={ADMIN_COPY.detail.viewer.rotateTitle}
                            >
                              ↻
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setZoomLevel(1);
                                setRotation(0);
                              }}
                              title={ADMIN_COPY.detail.viewer.reset}
                            >
                              {ADMIN_COPY.detail.viewer.resetButton}
                            </Button>
                          </div>
                        ) : null}
                      </CardHeader>

                      <CardContent className="flex-1 min-h-96 flex flex-col items-center justify-center p-6 bg-muted/30">
                        {signedUrl ? (
                          <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
                            <div className="mb-2 text-sm font-mono text-muted-foreground">
                              {ADMIN_COPY.detail.viewer.expiry(expiresIn)}
                            </div>
                            {contentType === 'pdf' ? (
                              // T-387: el visor de PDF del navegador no funciona con `sandbox`; el PDF se sirve desde
                              // Storage, de otro origen, así que no accede a la app. La URL vence a los 60 s.
                              <div className="flex w-full flex-col items-center gap-2">
                                <iframe
                                  src={signedUrl}
                                  title={ADMIN_COPY.detail.viewer.pdfTitle(ADMIN_COPY.documentKind[doc.documentType])}
                                  referrerPolicy="no-referrer"
                                  className="h-96 w-full rounded-md border border-border bg-card shadow-md"
                                />
                                <a
                                  href={signedUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                                >
                                  {ADMIN_COPY.detail.viewer.openPdf}
                                </a>
                              </div>
                            ) : (
                              <div className="overflow-auto max-h-96 w-full flex items-center justify-center p-4">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={signedUrl}
                                  alt={ADMIN_COPY.detail.viewer.imageAlt(ADMIN_COPY.documentKind[doc.documentType])}
                                  className={cn(
                                    'max-h-96 max-w-full rounded-md border border-border bg-card object-contain shadow-md',
                                    ZOOM_CLASSES[zoomLevel],
                                    ROTATION_CLASSES[rotation]
                                  )}
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center space-y-4 max-w-sm">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                              <svg
                                className="h-6 w-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-foreground">
                                {ADMIN_COPY.detail.viewer.protectedTitle}
                              </h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                {ADMIN_COPY.detail.viewer.protectedDescription}
                              </p>
                            </div>
                            <Button
                              onClick={handleLoadDocument}
                              disabled={loadingDoc}
                              className="w-full text-sm font-medium"
                            >
                              {loadingDoc
                                ? ADMIN_COPY.detail.loadingDocument
                                : ADMIN_COPY.detail.loadDocument}
                            </Button>
                          </div>
                        )}
                      </CardContent>

                      {/* Barra inferior de verificación del documento actual */}
                      {isSelected && signedUrl ? (
                        <div className="border-t border-border p-4 bg-card flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {doc.isCurrent === false
                              ? 'Documento histórico (no admite revisión).'
                              : ADMIN_COPY.detail.viewer.validityQuestion}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              ref={rejectDocTriggerRef}
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                rejectDocForm.reset();
                                setRejectDocDialogOpen(true);
                              }}
                              disabled={doc.status === 'rejected' || doc.isCurrent === false}
                            >
                              {ADMIN_COPY.detail.rejectDocument}
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={handleApproveDocument}
                              disabled={verifyingDoc || doc.status === 'verified' || doc.isCurrent === false}
                            >
                              {verifyingDoc ? ADMIN_COPY.detail.verifyingDocument : ADMIN_COPY.detail.verifyDocument}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </Card>
                  </TabsContent>
                );
              })
            )}
          </div>
        </div>
      </Tabs>
      </div>

      {/* Columna derecha (40 %): datos sin CBU ni DNI, consentimientos e historial */}
      <aside className="space-y-4 lg:col-span-2">
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{ADMIN_COPY.detail.dataTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{ADMIN_COPY.detail.dataLabels.name}</dt>
              <dd className="col-span-2 font-medium text-foreground">{applicant.fullName}</dd>
              <dt className="text-muted-foreground">{ADMIN_COPY.detail.dataLabels.phone}</dt>
              <dd className="col-span-2 font-medium text-foreground">{applicant.phone || '—'}</dd>
              <dt className="text-muted-foreground">{ADMIN_COPY.detail.dataLabels.vehicle}</dt>
              <dd className="col-span-2 font-medium text-foreground">
                {ADMIN_COPY.detail.vehicleWithPlate(ADMIN_COPY.vehicleType[applicant.vehicleType], applicant.vehiclePlate)}
              </dd>
              <dt className="text-muted-foreground">{ADMIN_COPY.detail.dataLabels.registeredAt}</dt>
              <dd className="col-span-2 font-medium text-foreground">{formatDate(applicant.createdAt)}</dd>
              <dt className="text-muted-foreground">{ADMIN_COPY.detail.dataLabels.level}</dt>
              <dd className="col-span-2 font-semibold text-foreground">{ADMIN_COPY.queue.level(applicant.docLevel)}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{ADMIN_COPY.detail.consentsTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            {applicant.consents && applicant.consents.length > 0 ? (
              <ul aria-label={ADMIN_COPY.detail.consentsTitle} className="space-y-2 text-sm">
                {applicant.consents.map((consent) => (
                  <li key={`${consent.document}-${consent.version}`}>
                    <span className="font-medium text-foreground">
                      {ADMIN_COPY.detail.consentDocument[consent.document]}
                    </span>
                    <span className="block text-muted-foreground">
                      {ADMIN_COPY.detail.consentLine(consent.version, formatDate(consent.acceptedAt, 'dateTime'))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{ADMIN_COPY.detail.consentsEmpty}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{ADMIN_COPY.detail.historyTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <ApplicantHistory events={applicant.history ?? []} />
          </CardContent>
        </Card>
      </aside>
      </div>

      {/* Barra de acciones fija (A02): sticky reserva su alto, así no tapa contenido */}
      <div
        role="toolbar"
        aria-label={ADMIN_COPY.detail.actionsBarLabel}
        className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background py-3"
      >
        {applicant.status === 'pending' ? (
          <>
            <Button
              variant="outline"
              onClick={() => {
                setDecisionError(null);
                setRejectApplicantOpen(true);
              }}
            >
              {ADMIN_COPY.detail.applicantActions.reject}
            </Button>
            <Button variant="default" onClick={() => openDecisionModal('approved')}>
              {ADMIN_COPY.detail.applicantActions.approve}
            </Button>
          </>
        ) : applicant.status === 'approved' ? (
          <Button variant="destructive" onClick={() => openDecisionModal('suspended')}>
            {ADMIN_COPY.detail.applicantActions.suspend}
          </Button>
        ) : applicant.status === 'suspended' ? (
          <Button variant="default" onClick={() => openDecisionModal('reactivate')}>
            {ADMIN_COPY.detail.applicantActions.reactivate}
          </Button>
        ) : (
          <Button variant="outline" onClick={() => openDecisionModal('reconsider')}>
            {ADMIN_COPY.detail.applicantActions.reconsider}
          </Button>
        )}
      </div>

      {/* Dialog oficial de decisión sobre el postulante */}
      <Dialog
        open={decisionModal !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDecisionModal(null);
            decisionForm.reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionModal
                ? ADMIN_COPY.detail.decisionDialogTitle(decisionModal)
                : ADMIN_COPY.detail.decisionDialogTitle(null)}
            </DialogTitle>
            <DialogDescription>
              {ADMIN_COPY.detail.decisionDialogDescription}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onDecisionSubmit} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="decision-reason"
                className="block text-sm font-medium text-foreground"
              >
                {ADMIN_COPY.detail.decisionDialogReasonLabel}{' '}
                <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="decision-reason"
                rows={4}
                {...decisionForm.register('reason')}
                placeholder={ADMIN_COPY.detail.decisionPlaceholder(decisionModal)}
              />
              {decisionForm.formState.errors.reason ? (
                <p className="text-sm font-medium text-destructive" role="alert">
                  {decisionForm.formState.errors.reason.message}
                </p>
              ) : null}
            </div>

            {decisionModal === 'reactivate' || decisionModal === 'reconsider' ? (
              <p className="text-sm text-muted-foreground">{ADMIN_COPY.detail.reinstateDialogNote}</p>
            ) : null}

            {decisionError ? (
              <p className="text-sm font-medium text-destructive" role="alert">
                {decisionError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDecisionModal}
                disabled={decisionForm.formState.isSubmitting}
              >
                {ADMIN_COPY.detail.cancelButton}
              </Button>
              <Button
                type="submit"
                variant={decisionModal === 'suspended' ? 'destructive' : 'default'}
                disabled={decisionForm.formState.isSubmitting}
              >
                {decisionForm.formState.isSubmitting
                  ? ADMIN_COPY.detail.decisionDialogProcessing
                  : ADMIN_COPY.detail.decisionDialogConfirm}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* T-404 (A02-rechazar): motivo de lista + mensaje para el postulante */}
      <Dialog
        open={rejectApplicantOpen}
        onOpenChange={(open) => {
          if (!open) closeRejectApplicant();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ADMIN_COPY.detail.rejectApplicant.title(applicant.fullName)}</DialogTitle>
            <DialogDescription>{ADMIN_COPY.detail.rejectApplicant.description}</DialogDescription>
          </DialogHeader>

          <form onSubmit={onRejectApplicantSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="reject-applicant-option" className="block text-sm font-medium text-foreground">
                {ADMIN_COPY.detail.rejectApplicant.optionLabel} <span className="text-destructive">*</span>
              </label>
              <Select
                value={rejectOption ?? ''}
                onValueChange={(value) =>
                  rejectApplicantForm.setValue('option', value as RejectApplicantFormInput['option'], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger
                  id="reject-applicant-option"
                  hasError={Boolean(rejectApplicantForm.formState.errors.option)}
                  aria-describedby={
                    rejectApplicantForm.formState.errors.option ? 'reject-applicant-option-error' : undefined
                  }
                >
                  <SelectValue placeholder={ADMIN_COPY.detail.rejectApplicant.optionPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {APPLICANT_REJECTION_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {rejectApplicantForm.formState.errors.option ? (
                <p id="reject-applicant-option-error" className="text-sm font-medium text-destructive" role="alert">
                  {rejectApplicantForm.formState.errors.option.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="reject-applicant-message" className="block text-sm font-medium text-foreground">
                {ADMIN_COPY.detail.rejectApplicant.messageLabel}
                {rejectOption === 'Otro' ? <span className="text-destructive"> *</span> : null}
              </label>
              <Textarea
                id="reject-applicant-message"
                rows={3}
                maxLength={450}
                {...rejectApplicantForm.register('message')}
                placeholder={ADMIN_COPY.detail.rejectApplicant.messagePlaceholder}
              />
              <p className="text-sm text-muted-foreground">{ADMIN_COPY.detail.rejectApplicant.messageRequiredHint}</p>
              {rejectApplicantForm.formState.errors.message ? (
                <p className="text-sm font-medium text-destructive" role="alert">
                  {rejectApplicantForm.formState.errors.message.message}
                </p>
              ) : null}
            </div>

            {decisionError ? (
              <p className="text-sm font-medium text-destructive" role="alert">
                {decisionError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeRejectApplicant}
                disabled={rejectApplicantForm.formState.isSubmitting}
              >
                {ADMIN_COPY.detail.cancelButton}
              </Button>
              <Button type="submit" variant="destructive" disabled={rejectApplicantForm.formState.isSubmitting}>
                {rejectApplicantForm.formState.isSubmitting
                  ? ADMIN_COPY.detail.rejectApplicant.processing
                  : ADMIN_COPY.detail.rejectApplicant.confirm}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog oficial de rechazo documental específico */}
      <Dialog
        open={rejectDocDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeRejectDocDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ADMIN_COPY.detail.rejectDialogTitle}</DialogTitle>
            <DialogDescription>
              {ADMIN_COPY.detail.rejectDialogDescription(
                currentDoc ? ADMIN_COPY.documentKind[currentDoc.documentType] : ''
              )}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onRejectDocSubmit} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="reject-doc-reason"
                className="block text-sm font-medium text-foreground"
              >
                {ADMIN_COPY.detail.rejectDialogReasonLabel}{' '}
                <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="reject-doc-reason"
                rows={3}
                {...rejectDocForm.register('rejectionReason')}
                placeholder={ADMIN_COPY.detail.rejectDialogReasonPlaceholder}
              />
              {rejectDocForm.formState.errors.rejectionReason ? (
                <p className="text-sm font-medium text-destructive" role="alert">
                  {rejectDocForm.formState.errors.rejectionReason.message}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeRejectDocDialog}
                disabled={rejectDocForm.formState.isSubmitting}
              >
                {ADMIN_COPY.detail.cancelButton}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={rejectDocForm.formState.isSubmitting}
              >
                {rejectDocForm.formState.isSubmitting
                  ? ADMIN_COPY.detail.rejectDialogCanceling
                  : ADMIN_COPY.detail.rejectDialogConfirm}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
