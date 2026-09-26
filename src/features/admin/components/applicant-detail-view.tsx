'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Textarea } from '@/ui/textarea';
import { notify } from '@/ui/notify';
import {
  viewCourierDocumentAction,
  decideCourierAction,
  suspendCourierAction,
  verifyCourierDocumentAction,
} from '../actions';
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

export function ApplicantDetailView({ applicant }: ApplicantDetailViewProps) {
  const router = useRouter();

  // Selección de documento actual
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
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);

  // Estados de formularios de decisión
  const [decisionModal, setDecisionModal] = React.useState<
    'approved' | 'rejected' | 'suspended' | null
  >(null);
  const [decisionReason, setDecisionReason] = React.useState('');
  const [submittingDecision, setSubmittingDecision] = React.useState(false);

  // Verificación de documento individual
  const [verifyingDoc, setVerifyingDoc] = React.useState(false);

  // Reset del visor al cambiar de documento
  React.useEffect(() => {
    setSignedUrl(null);
    setExpiresIn(0);
    setZoom(1);
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

  async function handleVerifyDocument(verified: boolean) {
    if (!currentDoc) return;
    setVerifyingDoc(true);
    try {
      const res = await verifyCourierDocumentAction({
        documentId: currentDoc.id,
        verified,
        rejectionReason: verified ? null : 'Rechazado en revisión visual administrativa',
      });

      if (!res.ok) {
        notify.error('Error al actualizar el estado del documento.');
        return;
      }

      notify.success(
        verified
          ? 'Documento verificado correctamente.'
          : 'Documento marcado como rechazado.'
      );
      router.refresh();
    } catch {
      notify.error('Error de conexión al verificar documento.');
    } finally {
      setVerifyingDoc(false);
    }
  }

  async function handleSubmitDecision() {
    if (!decisionModal) return;
    const cleanReason = decisionReason.trim();
    if (!cleanReason) {
      notify.error('El motivo de la decisión es obligatorio para auditoría.');
      return;
    }

    setSubmittingDecision(true);
    try {
      if (decisionModal === 'suspended') {
        const res = await suspendCourierAction({
          courierId: applicant.id,
          reason: cleanReason,
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
          reason: cleanReason,
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
      setDecisionReason('');
      router.refresh();
    } catch {
      notify.error('Error al procesar la decisión.');
    } finally {
      setSubmittingDecision(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Navegación de regreso */}
      <div className="flex items-center gap-2">
        <Link
          href="/admin/applicants"
          className="text-sm font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← Volver a la lista de postulantes
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
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm flex items-start gap-3">
        <svg
          className="h-5 w-5 text-amber-600 mt-0.5 shrink-0"
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
          <span className="font-semibold">Acceso Auditado y Restringido:</span> El acceso a estos documentos queda registrado en la auditoría inmutable. Las imágenes se sirven exclusivamente mediante URLs temporales de 60 segundos desde almacenamiento privado cifrado.
        </div>
      </div>

      {/* Tabs y Visor Documental A02 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Selector lateral de documentos */}
        <Card className="lg:col-span-1 border border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Documentación ({applicant.documents.length})</CardTitle>
            <CardDescription className="text-sm">Seleccioná un archivo para revisarlo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {applicant.documents.map((doc) => {
              const isSelected = doc.id === selectedDocId;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedDocId(doc.id)}
                  className={`w-full text-left p-3 rounded-md text-sm transition-colors flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isSelected
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'hover:bg-slate-100 text-foreground'
                  }`}
                >
                  <span className="truncate">{DOC_KIND_LABELS[doc.documentType] || doc.documentType}</span>
                  <span className="text-sm shrink-0 ml-2">
                    {doc.status === 'verified' ? '✓' : doc.status === 'rejected' ? '✕' : '•'}
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Panel central del visor */}
        <Card className="lg:col-span-3 border border-border shadow-sm flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border py-3">
            <div>
              <CardTitle className="text-base font-semibold">
                {currentDoc ? (DOC_KIND_LABELS[currentDoc.documentType] || currentDoc.documentType) : 'Sin documento'}
              </CardTitle>
              {currentDoc ? (
                <CardDescription className="text-sm">
                  Estado: <span className="font-medium text-foreground">{currentDoc.status.toUpperCase()}</span> · Subido el{' '}
                  {new Date(currentDoc.uploadedAt).toLocaleString('es-AR')}
                </CardDescription>
              ) : null}
            </div>

            {/* Controles del visor: Zoom, Rotación, Reset */}
            {signedUrl ? (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setZoom((z) => Math.max(0.5, z / 1.2))}
                  aria-label="Reducir zoom"
                  title="Reducir zoom"
                >
                  -
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setZoom((z) => Math.min(3, z * 1.2))}
                  aria-label="Aumentar zoom"
                  title="Aumentar zoom"
                >
                  +
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  aria-label="Rotar 90 grados"
                  title="Rotar 90°"
                >
                  ↻
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setZoom(1);
                    setRotation(0);
                  }}
                  title="Restablecer vista"
                >
                  Reset
                </Button>
              </div>
            ) : null}
          </CardHeader>

          <CardContent className="flex-1 min-h-[420px] flex flex-col items-center justify-center p-6 bg-slate-100/50">
            {!currentDoc ? (
              <p className="text-sm text-muted-foreground">No hay documentos registrados para este postulante.</p>
            ) : signedUrl ? (
              <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
                <div className="mb-2 text-sm font-mono text-muted-foreground">
                  URL temporal expira en: <span className="font-bold text-foreground">{expiresIn}s</span>
                </div>
                <div className="overflow-auto max-h-[500px] w-full flex items-center justify-center p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={signedUrl}
                    alt={`Documento ${DOC_KIND_LABELS[currentDoc.documentType] || currentDoc.documentType}`}
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      transition: 'transform 0.2s ease-in-out',
                    }}
                    className="max-h-[420px] max-w-full object-contain rounded-md shadow-md bg-white border border-border"
                  />
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4 max-w-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-slate-600">
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
                  <h3 className="text-sm font-semibold text-foreground">Documento protegido</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Hacé clic para generar un enlace temporal firmado de 60 segundos y registrar el evento en auditoría.
                  </p>
                </div>
                <Button
                  onClick={handleLoadDocument}
                  disabled={loadingDoc}
                  className="w-full text-sm font-medium"
                >
                  {loadingDoc ? 'Generando acceso seguro...' : 'Cargar documento seguro (60s)'}
                </Button>
              </div>
            )}
          </CardContent>

          {/* Barra inferior de verificación del documento actual */}
          {currentDoc && signedUrl ? (
            <div className="border-t border-border p-4 bg-white flex items-center justify-between">
              <span className="text-sm text-muted-foreground">¿El documento es legible y válido?</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleVerifyDocument(false)}
                  disabled={verifyingDoc || currentDoc.status === 'rejected'}
                >
                  Rechazar documento
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleVerifyDocument(true)}
                  disabled={verifyingDoc || currentDoc.status === 'verified'}
                >
                  Verificar documento
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      {/* Modal / Diálogo de decisión sobre el postulante */}
      {decisionModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg shadow-xl border border-border">
            <CardHeader>
              <CardTitle className="text-lg font-bold">
                {decisionModal === 'approved'
                  ? 'Aprobar repartidor'
                  : decisionModal === 'rejected'
                  ? 'Rechazar postulación'
                  : 'Suspender repartidor'}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Para garantizar la transparencia operativa, debés ingresar el motivo vinculante que quedará registrado en el historial.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="decision-reason" className="block text-sm font-medium text-foreground mb-1">
                  Motivo de la decisión <span className="text-destructive">*</span>
                </label>
                <Textarea
                  id="decision-reason"
                  rows={4}
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  placeholder={
                    decisionModal === 'approved'
                      ? 'Ej: Documentación DNI y selfie verificada. Cumple con los requisitos del piloto.'
                      : decisionModal === 'rejected'
                      ? 'Ej: Documento DNI ilegible o vencido.'
                      : 'Ej: Reclamo reiterado de comercios por demora injustificada.'
                  }
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDecisionModal(null);
                    setDecisionReason('');
                  }}
                  disabled={submittingDecision}
                >
                  Cancelar
                </Button>
                <Button
                  variant={decisionModal === 'approved' ? 'default' : 'destructive'}
                  onClick={handleSubmitDecision}
                  disabled={submittingDecision || !decisionReason.trim()}
                >
                  {submittingDecision ? 'Procesando...' : 'Confirmar decisión'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
