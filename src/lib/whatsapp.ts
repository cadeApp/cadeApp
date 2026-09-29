import { formatArs } from '@/lib/format';

export interface CoordinationMessageParams {
  requestCode: string;
  pickupZoneName: string;
  dropoffZoneName: string;
  amountArs: number;
  recipientPaymentMethod: string;
  needsChange: boolean;
  cashChangeAmount: number | null;
}

export interface NotifyCustomerMessageParams {
  amountArs: number;
  courierName: string;
  recipientPaymentMethod: string;
  needsChange: boolean;
  cashChangeAmount: number | null;
}

/**
 * Normaliza y valida estrictamente un número de teléfono argentino a 10 dígitos nacionales.
 * Limpia +54, 549, 0 inicial y 15 móvil intermedio tras códigos de área (2, 3 o 4 dígitos).
 * Lanza un error descriptivo si el número resultante no tiene exactamente 10 dígitos.
 */
export function extractValidArgentineTenDigits(rawPhone: string): string {
  if (!rawPhone || typeof rawPhone !== 'string') {
    throw new Error('Número de teléfono inválido: se requieren 10 dígitos nacionales');
  }

  let digits = rawPhone.replace(/\D/g, '');

  if (digits.startsWith('549') && digits.length >= 13) {
    digits = digits.slice(3);
  } else if (digits.startsWith('54') && digits.length >= 12) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Limpiar '15' móvil según código de área (interior ej: 3865, 381, 11)
  if (digits.length === 12 && digits.slice(4, 6) === '15') {
    digits = `${digits.slice(0, 4)}${digits.slice(6)}`;
  } else if (digits.length === 12 && digits.slice(3, 5) === '15') {
    digits = `${digits.slice(0, 3)}${digits.slice(5)}`;
  } else if (digits.length === 12 && digits.slice(2, 4) === '15') {
    digits = `${digits.slice(0, 2)}${digits.slice(4)}`;
  }

  if (digits.length !== 10) {
    throw new Error(
      `Número de teléfono inválido (${rawPhone}): se requieren exactamente 10 dígitos nacionales (código de área sin 0 y número sin 15).`
    );
  }

  return digits;
}

/**
 * Construye la URL oficial de wa.me con el prefijo internacional de Argentina 549 y texto codificado.
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  const tenDigits = extractValidArgentineTenDigits(phone);
  const international = `549${tenDigits}`;
  const baseUrl = `https://wa.me/${international}`;

  if (!message || message.trim().length === 0) {
    return baseUrl;
  }

  return `${baseUrl}?text=${encodeURIComponent(message)}`;
}

/**
 * Genera el mensaje de WhatsApp para coordinación comercio ↔ repartidor.
 * Cumple "sin datos de más" usando allowlist estricta (H04).
 */
export function buildTripCoordinationWhatsAppMessage(params: CoordinationMessageParams): string {
  const code = params.requestCode;
  const pickup = params.pickupZoneName;
  const dropoff = params.dropoffZoneName;
  const amount = formatArs(params.amountArs);

  let paymentText = 'Efectivo';
  if (params.recipientPaymentMethod === 'transfer') {
    paymentText = 'Transferencia';
  } else if (params.recipientPaymentMethod === 'to_agree') {
    paymentText = 'A coordinar';
  }

  let changeText = '';
  if (params.needsChange && params.cashChangeAmount) {
    changeText = ` (necesita cambio de ${formatArs(params.cashChangeAmount)})`;
  }

  return `Hola! Coordinación de viaje ${code} (${pickup} -> ${dropoff}): monto ${amount}, pago: ${paymentText}${changeText}.`;
}

/**
 * Genera el mensaje de WhatsApp "Avisar a mi cliente" (comercio ↔ destinatario).
 * Cumple "sin datos de más" usando allowlist estricta (H04).
 */
export function buildNotifyCustomerWhatsAppMessage(params: NotifyCustomerMessageParams): string {
  const courier = params.courierName;
  const amount = formatArs(params.amountArs);

  let paymentText = 'Efectivo';
  if (params.recipientPaymentMethod === 'transfer') {
    paymentText = 'Transferencia';
  } else if (params.recipientPaymentMethod === 'to_agree') {
    paymentText = 'A coordinar';
  }

  let changeText = '';
  if (params.needsChange && params.cashChangeAmount) {
    changeText = ` (necesita cambio de ${formatArs(params.cashChangeAmount)})`;
  }

  return `Hola! Tu pedido va en camino con ${courier}. Costo de envío: ${amount}. Medio de pago: ${paymentText}${changeText}.`;
}
