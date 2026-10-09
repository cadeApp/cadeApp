import type { PackageType, RecipientPaymentMethod } from '@/domain/schemas';

export const OFFERS_COPY = {
  // Feed
  feedTitle: 'Solicitudes abiertas',
  liveBadge: 'En vivo',
  emptyFeedTitle: 'No hay pedidos disponibles',
  emptyFeedDescription: 'Cuando un comercio de Aguilares publique una solicitud, la vas a ver acá.',
  loadingFeed: 'Cargando solicitudes disponibles...',
  feedErrorTitle: 'No se pudieron actualizar los pedidos',
  feedErrorDescription: 'Ocurrió un problema de conexión al cargar los pedidos en vivo.',
  retryButton: 'Reintentar',
  loadMore: 'Cargar más',
  loadingMore: 'Cargando…',

  // Disponibilidad en feed
  unavailableAlertTitle: 'No estás disponible',
  unavailableAlertDescription: 'Activá Disponible para ver las solicitudes y recibir avisos.',

  // Tarjeta de solicitud
  offerButton: 'Ofertar',
  takeRequestButton: (amount: string) => `Tomar a ${amount}`,
  alreadyOfferedPrefix: 'Ya ofertaste',
  changeNeededBadge: 'Necesita cambio',
  changeAmountPrefix: 'Cambio para',
  // Medio de pago del destinatario: una etiqueta por valor canónico (RECIPIENT_PAYMENT_METHODS)
  paymentLabels: {
    cash: 'Paga en efectivo',
    transfer: 'Paga con transferencia',
    to_agree: 'A coordinar',
  } satisfies Record<RecipientPaymentMethod, string>,
  approxDistancePrefix: '≈',
  kmUnit: 'km',

  // Paquetes: una etiqueta por valor canónico (PACKAGE_TYPES)
  packageLabels: {
    sobre: 'Sobre',
    chico: 'Paquete chico',
    mediano: 'Paquete mediano',
    grande: 'Paquete grande',
  } satisfies Record<PackageType, string>,

  // Bottom Sheet Ofertar (R05)
  offerSheetTitle: 'Tu oferta',
  takeSheetTitle: 'Tomar solicitud',
  fixedPriceNotice: 'Precio fijado por el comercio',
  autoAssignNotice: 'Asignación inmediata: al confirmar, el pedido queda asignado.',
  manualAssignNotice: 'El comercio confirmará entre quienes tomen la solicitud.',
  amountLabel: 'Monto de la oferta',
  amountPlaceholder: '1.500',
  floorPrefix: 'Mínimo',
  etaLabel: '¿En cuánto llegás a retirar?',
  etaPlaceholder: 'Seleccioná el tiempo',
  messageLabel: 'Mensaje para el comercio',
  messagePlaceholder: 'Ej.: estoy cerca, voy en moto',
  privacyNotice:
    'Si te eligen, vas a ver las direcciones exactas, el mapa del recorrido y el contacto del cliente. El envío se lo cobrás a quien recibe.',
  submitOfferButton: 'Enviar oferta',
  submittingOffer: 'Enviando oferta...',
  takingRequest: 'Tomando pedido...',
  cancelButton: 'Cancelar',
  offerSuccess: '¡Oferta enviada con éxito!',
  takeSuccess: '¡Pedido tomado con éxito!',

  // Mis ofertas (R06)
  myOffersTitle: 'Mis ofertas',
  tabPending: 'Pendientes',
  tabAccepted: 'Aceptadas',
  tabOther: 'Otras',
  acceptedOfferBadge: '¡Te eligieron!',
  goToTripButton: 'Ir al viaje',
  withdrawOfferButton: 'Retirar oferta',
  withdrawingOffer: 'Retirando...',
  withdrawSuccess: 'Oferta retirada con éxito.',
  withdrawConfirmTitle: '¿Querés retirar tu oferta?',
  withdrawConfirmDescription: 'Si la retirás, el comercio ya no podrá aceptarla para este pedido.',
  withdrawConfirmAction: 'Sí, retirar oferta',

  // Navegación
  navRequests: 'Solicitudes',
  navMyOffers: 'Mis ofertas',
  navProfile: 'Perfil',
} as const;
