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
  selfieTitle: 'Selfie de validación',
  selfieSubtitle: 'Sin anteojos de sol ni gorra',
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
} as const;
