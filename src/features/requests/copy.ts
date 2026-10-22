export const requestsCopy = {
  newRequest: {
    pageTitle: 'Nueva solicitud de envío',
    pageSubtitle:
      'Completá los datos del retiro, entrega y paquete para recibir ofertas de repartidores.',
    stepPickup: 'Punto de retiro',
    stepDropoff: 'Destino y entrega',
    stepPackage: 'Detalles del paquete',
    stepPayment: 'Pago del envío',
    pickupAddressLabel: 'Dirección del comercio',
    pickupAddressPlaceholder: 'Ej. San Martín 350',
    pickupZoneLabel: 'Barrio de retiro',
    dropoffAddressLabel: 'Dirección de entrega',
    dropoffAddressPlaceholder: 'Ej. Av. Sarmiento 1200',
    dropoffZoneLabel: 'Barrio de entrega',
    useMyLocation: 'Usar mi ubicación',
    recipientNameLabel: 'Nombre de quien recibe',
    recipientNamePlaceholder: 'Ej. Lucía Gómez',
    recipientPhoneLabel: 'Teléfono de contacto',
    recipientPhonePlaceholder: 'Ej. 381 555-1234',
    recipientConsentLabel:
      'Declaro que cuento con la autorización del destinatario para compartir sus datos de contacto y entrega con el repartidor asignado.',
    packageTypeLabel: 'Tamaño del paquete',
    packageOptions: {
      sobre: {
        label: 'Sobre',
        description: 'Documentos, llaves o sobres pequeños',
      },
      chico: {
        label: 'Chico',
        description: 'Hasta 2 kg (ej: una hamburguesa, farmacia)',
      },
      mediano: {
        label: 'Mediano',
        description: 'Hasta 5 kg (ej: caja de zapatillas, pizza familiar)',
      },
      grande: {
        label: 'Grande',
        description: 'Hasta 10 kg (ej: torta decorada, bulto voluminoso)',
      },
    },
    paymentMethodLabel: 'Medio de pago del destinatario',
    paymentMethodHint:
      'El envío lo paga siempre quien recibe al momento de la entrega. Indicá cómo le va a pagar al repartidor.',
    paymentOptions: {
      cash: 'Efectivo',
      transfer: 'Transferencia',
      to_agree: 'A coordinar',
    },
    needsChangeLabel: '¿El destinatario necesita cambio?',
    changePresetLabel: 'Paga con billete de:',
    changePresets: [2000, 5000, 10000] as const,
    changeCustomPlaceholder: 'Otro monto en efectivo',
    notesLabel: 'Indicaciones o referencias (opcional)',
    notesPlaceholder: 'Ej. Portón negro al lado del kiosco. Tocar timbre 2B.',
    fixedPriceSection: 'Precio de envío acordado (opcional)',
    fixedPriceLabel: 'Precio del envío acordado',
    fixedPricePlaceholder: 'Ej. 1500 (vacío para recibir ofertas)',
    fixedPriceHint:
      'Si ya acordaste el costo del envío con tu cliente, podés fijarlo acá. Los repartidores solo podrán tomarlo por este monto.',
    autoAssignLabel: 'Asignar al primer repartidor que tome',
    autoAssignHint:
      'El primer repartidor aprobado y disponible que acepte quedará asignado al instante.',
    submitButton: 'Publicar solicitud',
    submittingButton: 'Publicando solicitud...',
    mapOutOfAguilares:
      'La ubicación seleccionada se encuentra fuera de los límites de Aguilares. Por favor, verificá el punto en el mapa.',
    distanceEstimate: (meters: number) => `Distancia estimada: ${(meters / 1000).toFixed(1)} km`,
    zoneCentroidNotice: 'Calculando distancia estimada entre barrios de Aguilares.',
    errorGeneric: 'Ocurrió un error al crear la solicitud. Por favor, intentá nuevamente.',
    viewCreditsLink: 'Ver mis créditos y planes',
    errorSubscription:
      'Tu cuenta no cuenta con una suscripción activa ni período piloto para publicar envíos. Contactate con soporte.',
    addDropButton: 'Agregar otra entrega',
    removeDropButton: 'Quitar entrega',
    dropCardTitle: (index: number) => `Entrega ${index}`,
    dropCounterAria: (index: number, total: number) => `Entrega ${index} de ${total}`,
    dropsLimitReached: (max: number) => `Alcanzaste el límite de ${max} entregas por solicitud.`,
    fixedPricePerDropHint:
      'El precio del envío es por entrega. Si tenés varias entregas, se multiplica automáticamente.',
    retryOriginalButton: 'Reintentar solicitud original',
    startNewRequestButton: 'Comenzar otra solicitud',
    confirmNewRequestButton: 'Confirmar nueva solicitud',
    cancelNewRequestButton: 'Cancelar',
    payloadConflictAlert:
      'El intento anterior de publicación no pudo confirmarse y los datos del formulario cambiaron. El envío anterior podría haberse creado en el servidor.',
    payloadConflictWarning:
      'Atención: El intento anterior podría haberse creado en el servidor. Al confirmar, se generará una solicitud adicional independiente.',
  },
  offers: {
    waitingOffers: 'Esperando ofertas',
    waitingOffersDescription:
      'Los repartidores de Aguilares están viendo tu solicitud. Las ofertas van a aparecer acá en tiempo real sin recargar la página.',
    errorLoadingOffers: 'No se pudieron cargar las ofertas',
    errorDescription: 'Ocurrió un problema de conexión al sincronizar las ofertas en vivo.',
    retryButton: 'Reintentar',
    loadMore: 'Cargar más',
    loadingMore: 'Cargando…',
  },
} as const;
