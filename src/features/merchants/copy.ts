export const merchantCopy = {
  onboarding: {
    stepIndicator: 'Paso 2 de 2',
    title: 'Contanos de tu negocio',
    subtitle: 'Completá los datos básicos para empezar a publicar envíos en Aguilares.',
    businessNameLabel: 'Nombre del negocio',
    businessNamePlaceholder: 'Ej. Panadería La Espiga',
    phoneLabel: 'Teléfono de contacto',
    phonePlaceholder: 'Ej. 381 555-0123',
    phoneHelper: 'Lo ve solo el repartidor que elijas.',
    zoneLabel: 'Barrio de retiro habitual',
    zonePlaceholder: 'Seleccioná un barrio',
    addressLabel: 'Dirección de retiro habitual',
    addressPlaceholder: 'Ej. San Martín 450',
    addressHelper: 'Se completa sola en cada solicitud. Podés cambiarla.',
    mapCardTitle: 'Ubicación del local en el mapa',
    mapCardHelper:
      'Mové el mapa para marcar la puerta de tu negocio. Muy útil si tu calle no tiene número.',
    useMyLocation: 'Usar mi ubicación actual',
    locating: 'Obteniendo ubicación...',
    geoNotSupported: 'Tu navegador no soporta geolocalización.',
    geoErrorFallback:
      'No pudimos obtener tu ubicación actual. Podés continuar con la dirección escrita.',
    mapOutOfAguilares:
      'Ubicación fuera de Aguilares. Por favor, marcá el local dentro del radio urbano de la ciudad.',
    mapFallbackNotice:
      'No pudimos cargar el mapa. No te preocupes: continuá con la dirección y agregá una referencia.',
    locationMarked: 'Ubicación marcada:',
    notesLabel: 'Referencia adicional',
    notesPlaceholder: 'Ej. Portón verde al lado de la farmacia, timbre blanco',
    pilotBadge: 'Piloto gratis',
    pilotNotice: 'Estás en el piloto gratis. Cuando termine te vamos a avisar cómo seguir.',
    acceptPilotTerms: 'Acepto los Términos del piloto',
    acceptTermsPrefix: 'Acepto los',
    pilotTermsLink: 'Términos del piloto',
    submitButton: 'Empezar',
    loadingButton: 'Guardando...',
    errorGeneric: 'Ocurrió un error al guardar los datos. Por favor reintentá.',
    errorTermsRequired: 'Tenés que aceptar los Términos del piloto para continuar.',
  },
} as const;

export type MerchantSubscriptionStatus = 'pilot' | 'active' | 'expired' | 'cancelled';

const MONTHS_ES_AR = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

export function formatCivilDateEsAr(civilDateStr: string | null): string {
  if (!civilDateStr) {
    return 'Sin fecha de vencimiento asignada';
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(civilDateStr.trim());
  if (!match) {
    return 'Sin fecha de vencimiento asignada';
  }
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  const monthName = MONTHS_ES_AR[monthIdx];
  if (!monthName || day < 1 || day > 31) {
    return 'Sin fecha de vencimiento asignada';
  }
  return `${String(day).padStart(2, '0')} de ${monthName} de ${year}`;
}

export function getSubscriptionDisplay(
  status: MerchantSubscriptionStatus,
  paidUntil: string | null
) {
  const formattedUntil = formatCivilDateEsAr(paidUntil);

  switch (status) {
    case 'pilot':
      return {
        badgeVariant: 'published' as const,
        badgeLabel: 'Etapa inicial',
        headline: 'Suscripción en período de prueba bonificado',
        description:
          'Podés publicar todas las entregas que necesites con el abono mensual bonificado.',
        untilLabel: formattedUntil,
      };
    case 'active':
      return {
        badgeVariant: 'verified' as const,
        badgeLabel: 'Suscripción al día',
        headline: 'Tu abono mensual está activo',
        description:
          'Tu comercio tiene habilitadas las publicaciones ilimitadas de envíos.',
        untilLabel: formattedUntil,
      };
    case 'expired':
      return {
        badgeVariant: 'expired' as const,
        badgeLabel: 'Vencida',
        headline: 'Tu suscripción está vencida',
        description:
          'Contactate con soporte para renovar el abono mensual y mantener el servicio activo.',
        untilLabel: formattedUntil,
      };
    case 'cancelled':
      return {
        badgeVariant: 'cancelled' as const,
        badgeLabel: 'Cancelada',
        headline: 'Suscripción cancelada',
        description:
          'Tu cuenta de comercio se encuentra pausada. Escribinos para reactivarla.',
        untilLabel: formattedUntil,
      };
    default: {
      const exhaustiveCheck: never = status;
      throw new Error(`Estado de suscripción no soportado: ${String(exhaustiveCheck)}`);
    }
  }
}

