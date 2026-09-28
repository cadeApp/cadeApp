/**
 * Textos en español rioplatense (es-AR) para notificaciones y soft prompt (Stitch T02).
 */
export const PUSH_COPY = {
  prompt: {
    backAriaLabel: 'Volver',
    title: '¿Te avisamos al instante?',
    subtitle: 'Te avisamos cuando aparezca una solicitud nueva o cuando te elijan.',
    benefitSpeedTitle: 'Cero demoras',
    benefitSpeedDesc: 'Enterate al segundo y agarrá viajes antes que nadie.',
    benefitNoSpamTitle: 'Sin spam molesto',
    benefitNoSpamDesc: 'Solo alertas directas sobre tus pedidos activos.',
    fallbackNote: 'Si no llegan, igual lo vas a ver en la app al abrirla.',
    statusSuccess: '¡Avisos activados con éxito!',
    statusDenied:
      'Avisos bloqueados en el navegador. Podés activarlos en cualquier momento desde los ajustes del sitio.',
    statusUnsupported: 'Las notificaciones no están soportadas en este navegador.',
    statusSubscriptionError:
      'No se pudo confirmar la suscripción con el servidor. Reintentá en unos momentos.',
    statusGenericError: 'No se pudo activar el permiso de avisos.',
    btnActivate: 'Activar avisos',
    btnActivating: 'Solicitando...',
    btnActivated: '¡Avisos activados!',
    btnDismiss: 'Ahora no',
  },
  notifications: {
    fallbackTitle: 'cadeApp',
    fallbackBody: 'Tenés una nueva notificación en cadeApp.',
    fallbackUpdateBody: 'Tenés una actualización en la aplicación.',
    requestPublishedTitle: 'Nueva solicitud disponible',
    requestPublishedBody: 'Hay un nuevo envío disponible en Aguilares.',
    offerSubmittedTitle: 'Nueva oferta recibida',
    offerSubmittedBody: 'Un repartidor envió una oferta para tu pedido.',
    offerAcceptedTitle: '¡Oferta aceptada!',
    offerAcceptedBody: 'Se confirmó la oferta para el envío.',
    requestCancelledTitle: 'Solicitud cancelada',
    requestCancelledBody: 'La solicitud de envío fue cancelada.',
    requestExpiredTitle: 'Solicitud vencida',
    requestExpiredBody: 'La solicitud de envío expiró sin confirmación.',
  },
} as const;
