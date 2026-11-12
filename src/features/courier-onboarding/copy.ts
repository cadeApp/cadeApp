/**
 * Textos en español rioplatense (es-AR) para el onboarding del repartidor (Stitch R01, R02, R03).
 */
export const COURIER_ONBOARDING_COPY = {
  // Pasos
  stepDatos: 'Datos',
  stepIdentidad: 'Identidad',
  stepVehiculo: 'Vehículo',
  stepListo: 'Listo',
  stepCounter1: 'Paso 2 de 4',
  stepCounter2: 'Paso 3 de 4',

  // R01 - Identidad
  identityTitle: 'Tu identidad',
  securityBannerTitle: 'Verificación de seguridad',
  securityBannerText:
    'Lo revisa una persona de cadeApp. Tus documentos se guardan privados y solo los ve el equipo que aprueba.',
  dniLabel: 'Número de DNI',
  dniPlaceholder: 'Ej.: 38.123.456',
  dniHelp: 'Asegurate de que coincida con el documento a subir.',
  documentsTitle: 'Documentación personal',
  documentsSubtitle: (uploaded: number, total: number) => `${uploaded} de ${total} cargados`,
  dniFrontTitle: 'DNI frente',
  dniFrontSubtitle: 'Sacá una foto clara del frente',
  dniBackTitle: 'DNI dorso',
  dniBackSubtitle: 'Sacá una foto clara del dorso',
  selfieTitle: 'Selfie con el DNI',
  selfieSubtitle:
    'Sostené el DNI junto a tu rostro. Ambos deben verse legibles, sin reflejos ni obstrucciones',
  avatarTitle: 'Foto de perfil',
  avatarSubtitle: 'La van a ver los comercios cuando ofertes',
  acceptedFormatsTip: 'Formatos aceptados: JPG, PNG o WebP. Compresión automática a menos de 500 KB.',
  btnContinue: 'Continuar',
  btnRetry: 'Reintentar',
  btnUploading: 'Subiendo...',
  btnCompressing: 'Optimizando...',
  btnUploaded: 'Cargado',
  btnChange: 'Cambiar',
  btnUpload: 'Subir',
  uploadErrorRetry: 'Error al subir. Tocá para reintentar.',

  // R02 - Vehículo
  vehicleTitle: 'Tu vehículo',
  vehicleHeadline: 'Elegí cómo vas a repartir',
  vehicleSubtitle: 'Podés modificar el transporte activo cuando quieras desde tu perfil de repartidor.',
  transportWalk: 'A pie',
  transportWalkSub: 'Hasta 1.5 km',
  transportBike: 'Bici',
  transportBikeSub: 'Urbano liviano',
  transportMoto: 'Moto',
  transportMotoSub: 'Mayor radio',
  transportCar: 'Auto',
  transportCarSub: 'Cargas grandes',
  plateLabel: 'Patente del vehículo',
  plateRequiredSub: 'Requerido para moto y auto',
  platePlaceholder: 'AB 123 CD',
  plateHelp: 'Formato estándar nacional o alfanumérico habilitado.',
  appearFirstTitle: 'Aparecé primero',
  appearFirstText:
    'Si subís tu licencia y tu seguro y los verificamos, los comercios ven tus ofertas primero y con insignia.',
  optionalDocsTitle: 'Documentación de respaldo (opcional)',
  licenseTitle: 'Licencia de conducir',
  licenseSub: 'Frente y dorso (opcional)',
  insuranceTitle: 'Seguro',
  insuranceSub: 'Póliza vigente (opcional)',
  consentsTitle: 'Consentimientos obligatorios',
  consentTosPrefix: 'Acepto los',
  consentTosLink: 'Términos para repartidores',
  consentPrivacyPrefix: 'Acepto la',
  consentPrivacyLink: 'Política de privacidad',
  consentPrivacySuffix: 'y el uso de mis documentos para verificarme',
  consentContractText:
    'Entiendo que soy independiente: cadeApp no me emplea ni cobra por mí',
  btnSubmitForReview: 'Enviar para revisión',
  btnSubmitting: 'Enviando...',

  // R03 - En revisión
  underReviewBadge: 'En revisión manual',
  underReviewTitle: 'Estamos revisando tus datos',
  underReviewSubtitle:
    'Te avisamos por acá y por notificación cuando estés aprobado. Suele demorar menos de 24 hs hábiles.',
  checklistTitle: 'Estado de tus documentos',
  checklistSubtitle: 'Revisión manual por el equipo administrativo de cadeApp',
  btnGoToFeed: 'Ir al panel de repartidor',
  btnSignOut: 'Cerrar sesión',

  // CC-025 / T-356 - Reemplazo de documentos rechazados
  rejectedBadge: 'Rechazado / requiere corrección',
  rejectedStatus: 'Rechazado / requiere corrección',
  btnReplace: 'Reemplazar',
  replacingDocument: 'Reemplazando...',
  documentReplacedSuccess: 'Documento enviado para nueva revisión.',

  // T-376 / CC-033 - Alta posterior de licencia o seguro desde el perfil
  optionalDocumentHint:
    'Podés subirlo ahora: queda en revisión y, cuando el admin lo valide, suma respaldo a tus ofertas.',
  optionalDocumentAddTitle: (title: string) => `Subir ${title.toLowerCase()}`,
  optionalDocumentSubtitle: 'Seleccioná una foto clara o un PDF: JPG, PNG, WebP o PDF.',
  // T-387: el reemplazo de licencia o seguro también admite PDF.
  replacementSubtitlePhotoOrPdf: 'Seleccioná una foto clara o un PDF para enviar a nueva revisión',
  optionalDocumentSubmitted: 'Documento enviado. Queda en revisión hasta que el admin lo valide.',
  optionalDocumentErrors: {
    network: 'No pudimos enviarlo por un problema de conexión. Volvé a seleccionar el archivo para reintentar.',
    invalidState: 'Este documento ya no se puede cargar desde acá. Actualizá la página para ver su estado.',
    unauthorized: 'Tu cuenta no puede cargar documentos en este momento.',
    notFound: 'No encontramos el archivo subido. Volvé a seleccionarlo para reintentar.',
    generic: 'No pudimos enviar el documento. Volvé a intentar en unos momentos.',
  },
  // CC-050 (SEC-09): errores del envío del alta. El de DNI es neutral y sale de ERROR_MESSAGES.
  submitErrors: {
    dailyLimit: 'Alcanzaste el máximo de 5 intentos de alta de hoy. Volvé a intentar mañana.',
    unauthorized: 'Tu cuenta no tiene rol de repartidor habilitado.',
    generic: 'Ocurrió un error al procesar tu solicitud. Por favor verificá los datos.',
    network: 'Error de conexión al enviar el formulario. Intentá nuevamente.',
    supportLink: 'Hablar con cadeApp',
    supportUnavailable: 'El soporte no está disponible por ahora. Volvé a intentar más tarde.',
    // Mensaje prearmado del WhatsApp de soporte: sin DNI ni datos personales.
    supportMessage: 'Hola, no pude completar mi alta como repartidor y necesito ayuda.',
  },
  // T-387: validación del archivo antes de subirlo (alta y reemplazo).
  documentFileErrors: {
    unsupportedPhoto: 'Ese formato no se admite. Subí una foto JPG, PNG o WebP.',
    unsupportedPhotoOrPdf: 'Ese formato no se admite. Subí una foto JPG, PNG o WebP, o un PDF.',
    pdfTooLarge: 'El PDF supera los 10 MB. Elegí un archivo más liviano.',
    invalidPdf: 'Ese archivo no es un PDF válido. Elegí otro o subí una foto.',
  },
  /** T-387: un mensaje por causa de rechazo del archivo, antes de subirlo. */
  documentFileErrorMessage(reason: 'unsupported_type' | 'too_large' | 'invalid_pdf', allowsPdf: boolean): string {
    switch (reason) {
      case 'too_large':
        return COURIER_ONBOARDING_COPY.documentFileErrors.pdfTooLarge;
      case 'invalid_pdf':
        return COURIER_ONBOARDING_COPY.documentFileErrors.invalidPdf;
      case 'unsupported_type':
        return allowsPdf
          ? COURIER_ONBOARDING_COPY.documentFileErrors.unsupportedPhotoOrPdf
          : COURIER_ONBOARDING_COPY.documentFileErrors.unsupportedPhoto;
    }
  },
} as const;

export const DOCUMENT_REJECTION_REASONS: Record<import('@/domain/schemas').DocumentRejectionCode, string> = {
  illegible: 'Documento borroso, ilegible o cortado.',
  expired: 'Documento vencido o no vigente.',
  data_mismatch: 'Los datos no coinciden con la identidad declarada.',
  wrong_type: 'El archivo no corresponde al tipo de documento solicitado.',
  incomplete: 'Documento incompleto (falta frente o dorso).',
  other_safe: 'Requiere nueva carga para verificación administrativa.',
};

export const DEFAULT_REJECTION_MESSAGE = 'Requiere nueva carga para verificación administrativa.';

export function getSafeRejectionMessage(code: string | null | undefined): string {
  if (code && code in DOCUMENT_REJECTION_REASONS) {
    return DOCUMENT_REJECTION_REASONS[code as import('@/domain/schemas').DocumentRejectionCode];
  }
  return DEFAULT_REJECTION_MESSAGE;
}


/** CC-042 / T-419: vehículos del repartidor. */
export const COURIER_VEHICLES_COPY = {
  title: 'Mis vehículos',
  subtitle: 'Cargá cada vehículo con su patente, su licencia y su seguro. Los comercios ven el que tengas activo.',
  activeBadge: 'Activo',
  useThis: 'Usar este',
  editPlate: 'Editar patente',
  savePlate: 'Guardar patente',
  cancel: 'Cancelar',
  remove: 'Quitar',
  plateLabel: 'Patente',
  noPlate: 'Sin patente',
  plateInsuranceNotice: 'Si cambiás la patente, vas a tener que volver a cargar el seguro de ese vehículo.',
  documentsTitle: 'Licencia y seguro',
  addTitle: 'Agregar otro vehículo',
  addButton: 'Agregar vehículo',
  addActiveLabel: 'Usarlo como activo',
  allTypesLoaded: 'Ya cargaste un vehículo de cada tipo.',
  backToProfile: 'Volver al perfil',
  loadError: 'No pudimos cargar tus vehículos. Recargá la página.',
  quickSwitchLabel: 'Vehículo',
  quickSwitchAria: 'Elegir el vehículo activo',
  switched: 'Listo, cambiaste el vehículo activo.',
  added: 'Vehículo agregado.',
  removed: 'Vehículo quitado.',
  plateSaved: 'Patente actualizada.',
  types: { walk: 'A pie', bike: 'Bici', moto: 'Moto', car: 'Auto' },
} as const;
