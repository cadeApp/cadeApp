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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/ui/tabs';
import { Textarea } from '@/ui/textarea';
import { notify } from '@/ui/notify';
import { cn } from '@/ui/cn';
import { formatDate } from '@/lib/format';
import {
  viewCourierDocumentAction,
  decideCourierAction,
  suspendCourierAction,
  verifyCourierDocumentAction,
} from '../actions';
import {
  decisionFormSchema,
  rejectDocumentFormSchema,
  type DecisionFormInput,
  type RejectDocumentFormInput,
} from '../schemas';
import { ADMIN_COPY } from '../copy';
import type { ApplicantDetail, ApplicantDocumentDetail } from '../types';

interface ApplicantDetailViewProps {
  readonly applicant: ApplicantDetail;
}

const DOC_KIND_LABELS: Record<string, string> = {
  dni_front: 'DNI Frente',
  dni_back: 'DNI Dorso',
  selfie: 'Selfie con DNI',
  license: 'Licencia de Conducir',
  insurance: 'Seguro de Vehículo',
  avatar: 'Foto de Perfil',
};

const ROTATION_CLASSES: Record<number, string> = {
  0: 'rotate-0',
  90: 'rotate-90',
  180: 'rotate-180',
  270: 'rotate-270',
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
  const [expiresIn, setExpiresIn] = React.useState<number>(0);
  const [loadingDoc, setLoadingDoc] = React.useState(false);
  const [zoomLevel, setZoomLevel] = React.useState(1);
  const [rotation, setRotation] = React.useState<0 | 90 | 180 | 270>(0);

  // Diálogo y formulario de decisión global sobre el postulante
  const [decisionModal, setDecisionModal] = React.useState<
    'approved' | 'rejected' | 'suspended' | null
  >(null);

  const decisionForm = useForm<DecisionFormInput>({
    resolver: zodResolver(decisionFormSchema),
    defaultValues: { reason: '' },
  });

  // Diálogo y formulario de rechazo documental específico
  const [rejectDocDialogOpen, setRejectDocDialogOpen] = React.useState(false);

  const rejectDocForm = useForm<RejectDocumentFormInput>({
    resolver: zodResolver(rejectDocumentFormSchema),
    defaultValues: { rejectionReason: '' },
  });

  // Verificación de documento individual (aprobación)
  const [verifyingDoc, setVerifyingDoc] = React.useState(false);

  // Reset del visor al cambiar de documento
  React.useEffect(() => {
    setSignedUrl(null);
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
        notify.error('No se pudo generar la URL firmada para el documento.');
        return;
      }

      setSignedUrl(res.data.signedUrl);
      setExpiresIn(res.data.expiresInSeconds);
      notify.success('Documento cargado bajo sesión auditada.');
    } catch {
      notify.error('Error al solicitar visualización del documento.');
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
        notify.error('Error al actualizar el estado del documento.');
        return;
      }

      notify.success('Documento verificado correctamente.');
      router.refresh();
    } catch {
      notify.error('Error de conexión al verificar documento.');
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
        notify.error('Error al actualizar el estado del documento.');
        return;
      }

      notify.success('Documento marcado como rechazado.');
      setRejectDocDialogOpen(false);
      rejectDocForm.reset();
      router.refresh();
    } catch {
      notify.error('Error de conexión al verificar documento.');
    }
  });

  const onDecisionSubmit = decisionForm.handleSubmit(async (data) => {
    if (!decisionModal) return;

    try {
      if (decisionModal === 'suspended') {
        const res = await suspendCourierAction({
          courierId: applicant.id,
          reason: data.reason,
        });
        if (!res.ok) {
          notify.error('No se pudo suspender al repartidor.');
          return;
        }
        notify.success('Repartidor suspendido con éxito.');
      } else {
        const res = await decideCourierAction({
          courierId: applicant.id,
          decision: decisionModal,
          reason: data.reason,
        });
        if (!res.ok) {
          notify.error('No se pudo registrar la decisión sobre el postulante.');
          return;
        }
        notify.success(
          decisionModal === 'approved'
            ? 'Postulante aprobado como repartidor activo.'
            : 'Postulación rechazada.'
        );
      }

      setDecisionModal(null);
      decisionForm.reset();
      router.refresh();
    } catch {
      notify.error('Error al procesar la decisión.');
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

      {/* Encabezado y datos del postulante */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border pb-6">
        <div>
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
              {applicant.status.toUpperCase()}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div>
              DNI Hash: <span className="font-mono text-foreground">{applicant.dniHash}</span>
            </div>
            {applicant.phone ? (
              <div>
                Teléfono: <span className="font-medium text-foreground">{applicant.phone}</span>
              </div>
            ) : null}
            <div>
              Vehículo: <span className="font-medium text-foreground">{applicant.vehicleType.toUpperCase()}</span>
              {applicant.vehiclePlate ? ` (${applicant.vehiclePlate})` : ''}
            </div>
            <div>
              Nivel: <span className="font-semibold text-foreground">Nivel {applicant.docLevel}</span>
            </div>
          </div>
        </div>

        {/* Acciones principales de decisión */}
        <div className="flex flex-wrap items-center gap-2">
          {applicant.status === 'pending' ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDecisionModal('rejected')}
              >
                Rechazar postulación
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setDecisionModal('approved')}
              >
                Aprobar repartidor
              </Button>
            </>
          ) : applicant.status === 'approved' ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDecisionModal('suspended')}
            >
              Suspender repartidor
            </Button>
          ) : applicant.status === 'suspended' ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => setDecisionModal('approved')}
            >
              Reactivar repartidor
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDecisionModal('approved')}
            >
              Reconsiderar aprobación
            </Button>
          )}
        </div>
      </div>

      {/* Banner inmutable de seguridad y auditoría A02 */}
      <div className="rounded-lg border badge-warning p-4 text-sm shadow-sm flex items-start gap-3">
        <svg
          className="h-5 w-5 mt-0.5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div>
          <span className="font-semibold">{ADMIN_COPY.detail.auditBannerTitle}</span>{' '}
          {ADMIN_COPY.detail.auditBannerText}
        </div>
      </div>

      {/* Tabs oficiales de documentos y visor A02 */}
      <Tabs
        value={selectedDocId}
        onValueChange={setSelectedDocId}
        className="w-full"
      >
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Selector lateral oficial de documentos con TabsList */}
          <Card className="lg:col-span-1 border border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Documentación ({applicant.documents.length})
              </CardTitle>
              <CardDescription className="text-sm">
                Seleccioná un archivo para revisarlo.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2">
              <TabsList
                className="flex flex-col h-auto w-full bg-transparent p-0 gap-1"
                aria-label="Documentos del postulante"
              >
                {applicant.documents.map((doc) => (
                  <TabsTrigger
                    key={doc.id}
                    value={doc.id}
                    className="w-full justify-between p-3 rounded-md text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-medium text-left"
                  >
                    <span className="truncate">
                      {DOC_KIND_LABELS[doc.documentType] || doc.documentType}
                    </span>
                    <span className="text-sm shrink-0 ml-2">
                      {doc.status === 'verified' ? '✓' : doc.status === 'rejected' ? '✕' : '•'}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </CardContent>
          </Card>

          {/* Panel central del visor con TabsContent */}
          <div className="lg:col-span-3">
            {applicant.documents.length === 0 ? (
              <Card className="border border-border shadow-sm">
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  No hay documentos registrados para este postulante.
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
                            {DOC_KIND_LABELS[doc.documentType] || doc.documentType}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            Estado:{' '}
                            <span className="font-medium text-foreground">
                              {doc.status.toUpperCase()}
                            </span>{' '}
                            · Subido el {formatDate(doc.uploadedAt, 'dateTime')}
                          </CardDescription>
                        </div>

                        {/* Controles de visor de documento */}
                        {isSelected && signedUrl ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setZoomLevel((z) => Math.max(0, z - 1))}
                              aria-label="Reducir zoom"
                              title="Reducir zoom"
                            >
                              -
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setZoomLevel((z) => Math.min(3, z + 1))}
                              aria-label="Aumentar zoom"
                              title="Aumentar zoom"
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
                              aria-label="Rotar 90 grados"
                              title="Rotar 90°"
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
                              title="Restablecer vista"
                            >
                              Reset
                            </Button>
                          </div>
                        ) : null}
                      </CardHeader>

                      <CardContent className="flex-1 min-h-96 flex flex-col items-center justify-center p-6 bg-muted/30">
                        {signedUrl ? (
                          <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
                            <div className="mb-2 text-sm font-mono text-muted-foreground">
                              URL temporal expira en:{' '}
                              <span className="font-bold text-foreground">{expiresIn}s</span>
                            </div>
                            <div className="overflow-auto max-h-96 w-full flex items-center justify-center p-4">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={signedUrl}
                                alt={`Documento ${DOC_KIND_LABELS[doc.documentType] || doc.documentType}`}
                                className={cn(
                                  'max-h-96 max-w-full object-contain rounded-md shadow-md bg-card border border-border transition-transform duration-200',
                                  ZOOM_CLASSES[zoomLevel],
                                  ROTATION_CLASSES[rotation]
                                )}
                              />
                            </div>
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
                                Documento protegido
                              </h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                Hacé clic para generar un enlace temporal firmado de 60 segundos y
                                registrar el evento en auditoría.
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
                      {signedUrl ? (
                        <div className="border-t border-border p-4 bg-card flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            ¿El documento es legible y válido?
                          </span>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                rejectDocForm.reset();
                                setRejectDocDialogOpen(true);
                              }}
                              disabled={doc.status === 'rejected'}
                            >
                              {ADMIN_COPY.detail.rejectDocument}
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={handleApproveDocument}
                              disabled={verifyingDoc || doc.status === 'verified'}
                            >
                              {verifyingDoc ? 'Verificando...' : ADMIN_COPY.detail.verifyDocument}
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
                : 'Decisión sobre postulante'}
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
                placeholder={
                  decisionModal === 'approved'
                    ? 'Ej: Documentación DNI y selfie verificada. Cumple con los requisitos del piloto.'
                    : decisionModal === 'rejected'
                    ? 'Ej: Documento DNI ilegible o vencido.'
                    : 'Ej: Reclamo reiterado de comercios por demora injustificada.'
                }
              />
              {decisionForm.formState.errors.reason ? (
                <p className="text-sm font-medium text-destructive" role="alert">
                  {decisionForm.formState.errors.reason.message}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDecisionModal(null);
                  decisionForm.reset();
                }}
                disabled={decisionForm.formState.isSubmitting}
              >
                {ADMIN_COPY.detail.cancelButton}
              </Button>
              <Button
                type="submit"
                variant={decisionModal === 'approved' ? 'default' : 'destructive'}
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

      {/* Dialog oficial de rechazo documental específico */}
      <Dialog
        open={rejectDocDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRejectDocDialogOpen(false);
            rejectDocForm.reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ADMIN_COPY.detail.rejectDialogTitle}</DialogTitle>
            <DialogDescription>
              {ADMIN_COPY.detail.rejectDialogDescription(
                currentDoc ? DOC_KIND_LABELS[currentDoc.documentType] || currentDoc.documentType : ''
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
                onClick={() => {
                  setRejectDocDialogOpen(false);
                  rejectDocForm.reset();
                }}
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
