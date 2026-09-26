/**
 * Textos y copys centralizados de la feature de administración (PR106-H16).
 */
export const ADMIN_COPY = {
  nav: {
    brandLabel: 'Panel de Administración cadeApp',
    badgeText: 'Admin (Aguilares)',
    logoutButton: 'Salir',
    ariaLabel: 'Navegación principal de administración',
  },
  queue: {
    title: 'Postulantes',
    description: 'Bandeja de verificación de documentación y aprobación de repartidores en Aguilares.',
    emptyTitle: (tabLabel: string) => `No hay postulantes en estado "${tabLabel}"`,
    emptyDescription: 'Cuando un repartidor complete su registro o cambie de estado, aparecerá en esta lista.',
    nextButton: 'Siguiente',
    reviewButton: 'Revisar',
  },
  detail: {
    backToList: '← Volver a la lista de postulantes',
    auditBannerTitle: 'Acceso Auditado y Restringido:',
    auditBannerText:
      'El acceso a estos documentos queda registrado en la auditoría inmutable. Las imágenes se sirven exclusivamente mediante URLs temporales de 60 segundos desde almacenamiento privado cifrado.',
    loadDocument: 'Cargar documento seguro (60s)',
    loadingDocument: 'Generando acceso seguro...',
    verifyDocument: 'Verificar documento',
    rejectDocument: 'Rechazar documento',
    rejectDialogTitle: 'Rechazar comprobante',
    rejectDialogDescription: (docLabel: string) =>
      `Ingresá el motivo específico por el cual se rechaza el documento ${docLabel}. Este motivo será notificado al postulante.`,
    rejectDialogReasonLabel: 'Motivo del rechazo',
    rejectDialogReasonPlaceholder: 'Ej: La imagen del DNI está borrosa y no se distinguen los números.',
    rejectDialogConfirm: 'Confirmar rechazo',
    rejectDialogCanceling: 'Rechazando...',
    decisionDialogTitle: (decision: string) =>
      decision === 'approved'
        ? 'Aprobar repartidor'
        : decision === 'rejected'
        ? 'Rechazar postulación'
        : 'Suspender repartidor',
    decisionDialogDescription:
      'Para garantizar la transparencia operativa, debés ingresar el motivo vinculante que quedará registrado en el historial.',
    decisionDialogReasonLabel: 'Motivo de la decisión',
    decisionDialogConfirm: 'Confirmar decisión',
    decisionDialogProcessing: 'Procesando...',
    cancelButton: 'Cancelar',
  },
  mfa: {
    title: 'Verificación en dos pasos',
    description:
      'Ingresá el código de 6 dígitos generado por tu app autenticadora (Google Authenticator, Authy, etc.).',
    codeLabel: 'Código de seguridad',
    verifyButton: 'Verificar código',
    verifyingButton: 'Verificando...',
    troubleshoot:
      '¿Problemas con el código de tu app autenticadora? Asegurate de que la hora de tu dispositivo esté sincronizada automáticamente.',
  },
} as const;
