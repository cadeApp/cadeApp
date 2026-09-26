/**
 * Textos y copys centralizados de la feature de administración (PR106-H16).
 */
export const ADMIN_COPY = {
  nav: {
    brandLabel: 'Panel de Administración cadeApp',
    badgeText: 'Admin (Aguilares)',
    logoutButton: 'Salir',
    ariaLabel: 'Navegación principal de administración',
    tabs: {
      applicants: 'Postulantes',
      merchants: 'Comercios',
      incidents: 'Incidentes',
      settings: 'Parámetros',
      audit: 'Auditoría',
    },
  },
  applicantStatus: {
    pending: 'Pendiente',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    suspended: 'Suspendido',
  },
  documentStatus: {
    none: 'Sin cargar',
    submitted: 'Pendiente',
    verified: 'Verificado',
    rejected: 'Rechazado',
  },
  vehicleType: {
    walk: 'A pie',
    bike: 'Bicicleta',
    moto: 'Moto',
    car: 'Automóvil',
  },
  documentKind: {
    dni_front: 'DNI Frente',
    dni_back: 'DNI Dorso',
    selfie: 'Selfie con DNI',
    avatar: 'Foto de Perfil',
    license: 'Licencia de Conducir',
    insurance: 'Seguro de Vehículo',
  },
  queue: {
    title: 'Postulantes',
    description:
      'Bandeja de verificación de documentación y aprobación de repartidores en Aguilares.',
    tabs: {
      pending: 'Pendientes',
      approved: 'Aprobados',
      rejected: 'Rechazados',
      suspended: 'Suspendidos',
    },
    columns: {
      applicant: 'Postulante',
      vehicle: 'Vehículo',
      documents: 'Documentación',
      level: 'Nivel',
      date: 'Fecha',
      action: 'Acción',
    },
    dniHashLabel: 'DNI Hash',
    dniBadge: 'DNI',
    selfieBadge: 'Selfie',
    licenseBadge: 'Licencia',
    insuranceBadge: 'Seguro',
    uploadedFeminine: 'subida',
    uploadedMasculine: 'subido',
    level: (value: number) => `Nivel ${value}`,
    emptyTitle: (tabLabel: string) => `No hay postulantes en estado "${tabLabel}"`,
    emptyDescription:
      'Cuando un repartidor complete su registro o cambie de estado, aparecerá en esta lista.',
    nextButton: 'Siguiente',
    reviewButton: 'Revisar',
  },
  detail: {
    backToList: '← Volver a la lista de postulantes',
    labels: {
      dniHash: 'DNI Hash',
      phone: 'Teléfono',
      vehicle: 'Vehículo',
      level: 'Nivel',
      state: 'Estado',
      uploadedAt: 'Subido el',
    },
    applicantActions: {
      reject: 'Rechazar postulación',
      approve: 'Aprobar repartidor',
      suspend: 'Suspender repartidor',
      reactivate: 'Reactivar repartidor',
      reconsider: 'Reconsiderar aprobación',
    },
    auditBannerTitle: 'Acceso Auditado y Restringido:',
    auditBannerText:
      'El acceso a estos documentos queda registrado en la auditoría inmutable. Las imágenes se sirven exclusivamente mediante URLs temporales de 60 segundos desde almacenamiento privado cifrado.',
    documentationTitle: (count: number) => `Documentación (${count})`,
    documentationDescription: 'Seleccioná un archivo para revisarlo.',
    documentsAriaLabel: 'Documentos del postulante',
    emptyDocuments: 'No hay documentos registrados para este postulante.',
    loadDocument: 'Cargar documento seguro (60s)',
    loadingDocument: 'Generando acceso seguro...',
    verifyDocument: 'Verificar documento',
    verifyingDocument: 'Verificando...',
    rejectDocument: 'Rechazar documento',
    viewer: {
      zoomOut: 'Reducir zoom',
      zoomIn: 'Aumentar zoom',
      rotate: 'Rotar 90 grados',
      rotateTitle: 'Rotar 90°',
      reset: 'Restablecer vista',
      resetButton: 'Reset',
      expiry: (seconds: number) => `URL temporal expira en: ${seconds}s`,
      protectedTitle: 'Documento protegido',
      protectedDescription:
        'Hacé clic para generar un enlace temporal firmado de 60 segundos y registrar el evento en auditoría.',
      validityQuestion: '¿El documento es legible y válido?',
      imageAlt: (label: string) => `Documento ${label}`,
    },
    rejectDialogTitle: 'Rechazar comprobante',
    rejectDialogDescription: (docLabel: string) =>
      `Ingresá el motivo específico por el cual se rechaza el documento ${docLabel}. Este motivo será notificado al postulante.`,
    rejectDialogReasonLabel: 'Motivo del rechazo',
    rejectDialogReasonPlaceholder:
      'Ej: La imagen del DNI está borrosa y no se distinguen los números.',
    rejectDialogConfirm: 'Confirmar rechazo',
    rejectDialogCanceling: 'Rechazando...',
    decisionDialogTitle: (decision: string | null) =>
      decision === 'approved'
        ? 'Aprobar repartidor'
        : decision === 'rejected'
        ? 'Rechazar postulación'
        : decision === 'suspended'
        ? 'Suspender repartidor'
        : 'Decisión sobre postulante',
    decisionDialogDescription:
      'Para garantizar la transparencia operativa, debés ingresar el motivo vinculante que quedará registrado en el historial.',
    decisionDialogReasonLabel: 'Motivo de la decisión',
    decisionPlaceholder: (decision: string | null) =>
      decision === 'approved'
        ? 'Ej: Documentación DNI y selfie verificada. Cumple con los requisitos del piloto.'
        : decision === 'rejected'
        ? 'Ej: Documento DNI ilegible o vencido.'
        : 'Ej: Reclamo reiterado de comercios por demora injustificada.',
    decisionDialogConfirm: 'Confirmar decisión',
    decisionDialogProcessing: 'Procesando...',
    cancelButton: 'Cancelar',
    success: {
      documentLoaded: 'Documento cargado bajo sesión auditada.',
      documentVerified: 'Documento verificado correctamente.',
      documentRejected: 'Documento marcado como rechazado.',
      courierSuspended: 'Repartidor suspendido con éxito.',
      applicantApproved: 'Postulante aprobado como repartidor activo.',
      applicantRejected: 'Postulación rechazada.',
    },
    errors: {
      loadDocumentConnection: 'Error de conexión al solicitar visualización del documento.',
      verifyDocumentConnection: 'Error de conexión al verificar documento.',
      decisionConnection: 'Error de conexión al procesar la decisión.',
    },
  },
  mfa: {
    title: 'Verificación en dos pasos',
    description:
      'Ingresá el código de 6 dígitos generado por tu app autenticadora (Google Authenticator, Authy, etc.).',
    codeLabel: 'Código de seguridad',
    countdown: (seconds: number) =>
      `Expira en 00:${String(seconds).padStart(2, '0')}`,
    invalidCode: 'Código incorrecto o expirado. Verificá tu app e intentá de nuevo.',
    connectionError: 'Error de conexión al verificar el segundo factor.',
    success: 'Identidad verificada con éxito.',
    validationFallback: 'Ingresá los 6 dígitos numéricos.',
    verifyButton: 'Verificar código',
    verifyingButton: 'Verificando...',
    troubleshoot:
      '¿Problemas con el código de tu app autenticadora? Asegurate de que la hora de tu dispositivo esté sincronizada automáticamente.',
  },
  errors: {
    queue: {
      title: 'No pudimos cargar la cola de postulantes',
      description: 'Ocurrió un inconveniente al consultar los datos de repartidores.',
      retry: 'Reintentar',
    },
    detail: {
      title: 'No pudimos cargar el detalle del postulante',
      description: 'Ocurrió un inconveniente al consultar la documentación del repartidor.',
      retry: 'Reintentar',
      back: 'Volver a la cola',
    },
  },
} as const;
