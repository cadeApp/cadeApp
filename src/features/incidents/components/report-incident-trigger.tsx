'use client';

import * as React from 'react';

// /trips/[id] tiene presupuesto de First Load JS (regla 25) y reportar es poco frecuente: el bundle inicial solo lleva
// esta isla. El Dialog, sus textos y el formulario se descargan cuando la persona muestra intención de abrirlo.
function loadReportIncidentDialog() {
  return import('./report-incident-dialog');
}

const ReportIncidentDialog = React.lazy(() =>
  loadReportIncidentDialog().then((module) => ({ default: module.ReportIncidentDialog }))
);

function preloadReportIncidentDialog() {
  void loadReportIncidentDialog();
}

export interface ReportIncidentTriggerProps {
  readonly requestId: string;
  readonly className: string;
  /** Texto para lectores de pantalla mientras llega el chunk del Dialog. */
  readonly loadingLabel: string;
  /** Ícono y texto del botón, que llegan ya renderizados desde el servidor. */
  readonly children: React.ReactNode;
}

/** Isla cliente del botón «Reportar un problema»: abre el Dialog diferido y devuelve el foco al cerrarlo. */
export function ReportIncidentTrigger({ requestId, className, loadingLabel, children }: ReportIncidentTriggerProps) {
  const [open, setOpen] = React.useState(false);
  const [requested, setRequested] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const wasOpen = React.useRef(false);

  // El DialogTrigger vive en el chunk diferido, así que el foco vuelve a este botón a mano cuando el Dialog se cierra
  // (Escape, Cancelar o envío exitoso).
  React.useEffect(() => {
    if (wasOpen.current && !open) {
      triggerRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={className}
        onPointerEnter={preloadReportIncidentDialog}
        onFocus={preloadReportIncidentDialog}
        onClick={() => {
          setRequested(true);
          setOpen(true);
        }}
      >
        {children}
      </button>

      {requested ? (
        <React.Suspense
          fallback={
            <p role="status" className="sr-only">
              {loadingLabel}
            </p>
          }
        >
          <ReportIncidentDialog requestId={requestId} open={open} onOpenChange={setOpen} />
        </React.Suspense>
      ) : null}
    </>
  );
}
