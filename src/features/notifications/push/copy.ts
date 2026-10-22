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
    statusPushServiceUnavailable:
      'Tu navegador no permitió activar los avisos. En Brave, activá «Usar los servicios de Google para mensajes push» en la configuración de privacidad y reiniciá el navegador. También podés probar con Chrome.',
    statusPermissionBlocked:
      'El navegador tiene bloqueados los avisos para este sitio. Tocá el ícono junto a la dirección, permití las notificaciones y volvé a intentar.',
    statusSessionExpired: 'Tu sesión venció. Volvé a iniciar sesión y activá los avisos de nuevo.',
    statusNetworkError: 'No hay conexión. Revisá tu internet y reintentá.',
    statusConfigError:
      'Los avisos no están disponibles por un problema de configuración. Igual vas a ver todo al abrir la app.',
    statusActive: 'Avisos activados en este navegador',
    statusCheckFailed: 'No se pudo comprobar el estado de los avisos.',
    statusDeactivated: 'Avisos desactivados en este navegador.',
    statusDeactivateError: 'No se pudieron desactivar los avisos. Reintentá en unos momentos.',
    statusDeactivatePending:
      'Este navegador ya no recibe avisos, pero el servidor todavía no confirmó la baja. Reintentá para completarla.',
    btnActivate: 'Activar avisos',
    btnActivating: 'Solicitando...',
    btnActivated: '¡Avisos activados!',
    btnDeactivate: 'Desactivar avisos',
    btnDeactivating: 'Desactivando...',
    btnRetryDeactivate: 'Reintentar baja',
    btnRetry: 'Reintentar',
    btnDismiss: 'Ahora no',
  },
  profileLink: {
    title: 'Notificaciones y avisos',
    description: 'Configurá las alertas instantáneas de pedidos',
    action: 'Configurar →',
  },
} as const;
