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
    submitButton: 'Publicar solicitud',
    submittingButton: 'Publicando solicitud...',
    mapOutOfAguilares:
      'La ubicación seleccionada se encuentra fuera de los límites de Aguilares. Por favor, verificá el punto en el mapa.',
    distanceEstimate: (meters: number) => `Distancia estimada: ${(meters / 1000).toFixed(1)} km`,
    zoneCentroidNotice: 'Calculando distancia estimada entre barrios de Aguilares.',
    errorGeneric: 'Ocurrió un error al crear la solicitud. Por favor, intentá nuevamente.',
    errorSubscription:
      'Tu cuenta no cuenta con una suscripción activa ni período piloto para publicar envíos. Contactate con soporte.',
  },
} as const;
