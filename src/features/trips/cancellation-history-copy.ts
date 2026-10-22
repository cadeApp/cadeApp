// T-373: textos de la cronología de cancelaciones de asignación (CC-032). Una cancelación del repartidor NO cancela
// el pedido: el texto lo dice en cada vista para no confundirla con `delivery_requests.status = 'cancelled'`.
export const CANCELLATION_HISTORY_COPY = {
  title: 'Historial de asignaciones',
  merchantDescription:
    'Cada vez que un repartidor canceló la asignación, el pedido volvió a recibir ofertas. Eso no cancela el pedido.',
  courierDescription: 'Tus cancelaciones de asignación en este pedido.',
  empty: 'Ningún repartidor canceló una asignación de este pedido.',
  error: 'No pudimos cargar el historial de asignaciones. Recargá la página para reintentar.',
  loadMore: 'Ver más',
  loadingMore: 'Cargando…',
  loadMoreError: 'No pudimos cargar más eventos del historial.',
  retry: 'Reintentar',
  unknownActor: 'Repartidor no disponible',
  courierCancelledTitle: 'Cancelaste esta asignación',
  courierCancelledDescription:
    'El pedido volvió a recibir ofertas de otros repartidores. No es una cancelación del pedido.',
  backToFeed: 'Volver a pedidos disponibles',
} as const;
