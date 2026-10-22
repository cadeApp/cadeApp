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
  courierName: string;
  sender: 'courier' | 'merchant';
  tripStatus: 'matched' | 'in_transit' | 'delivered';
  dropStatus?: 'pending' | 'delivered' | 'failed';
}

/**
 * Normaliza y valida estrictamente un número de teléfono argentino a 10 dígitos nacionales.
 * Limpia +54, 549, 0 inicial y 15 móvil intermedio tras códigos de área (2, 3 o 4 dígitos).
 * Lanza un error descriptivo si el número contiene letras, caracteres inválidos o no tiene exactamente 10 dígitos.
 */
export function extractValidArgentineTenDigits(rawPhone: string): string {
  if (!rawPhone || typeof rawPhone !== 'string' || rawPhone.trim().length === 0) {
    throw new Error('Número de teléfono inválido: se requieren 10 dígitos nacionales');
  }

  const trimmed = rawPhone.trim();

  if (/[a-zA-Z]/.test(trimmed)) {
    throw new Error('El número de teléfono no puede contener letras');
  }

  if (/[^0-9\s+().-]/.test(trimmed)) {
    throw new Error('El número de teléfono contiene caracteres o símbolos no permitidos');
  }

  // Validar signo + (solo al inicio como prefijo internacional +54, máximo uno)
  const plusMatches = trimmed.match(/\+/g);
  if (plusMatches) {
    if (plusMatches.length > 1) {
      throw new Error('El prefijo internacional + solo puede figurar una vez al inicio');
    }
    if (!trimmed.startsWith('+')) {
      throw new Error('El signo + solo puede figurar al inicio del número como prefijo internacional');
    }
    if (!/^\+\s*54/.test(trimmed)) {
      throw new Error('El prefijo internacional debe corresponder a Argentina (+54)');
    }
  }

  // Validar paréntesis (código de área balanceado, máximo un par, orden correcto)
  const openParens = (trimmed.match(/\(/g) || []).length;
  const closeParens = (trimmed.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    throw new Error('Los paréntesis del código de área están desbalanceados');
  }
  if (openParens > 1) {
    throw new Error('Solo se permite un par de paréntesis para el código de área');
  }
  if (openParens === 1) {
    const openIdx = trimmed.indexOf('(');
    const closeIdx = trimmed.indexOf(')');
    if (openIdx > closeIdx || !/\(\s*\d+\s*\)/.test(trimmed)) {
      throw new Error('Formato de paréntesis inválido para el código de área');
    }
  }

  // Rechazar símbolos repetidos no telefónicos (ej: -- o ..)
  if (/--|\.\./.test(trimmed)) {
    throw new Error('El número contiene separadores repetidos o inválidos');
  }

  let digits = trimmed.replace(/\D/g, '');

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
 * Determina si una cadena representa un número de teléfono argentino válido (10 dígitos nacionales).
 */
export function isValidArgentinePhone(phone: string): boolean {
  try {
    extractValidArgentineTenDigits(phone);
    return true;
  } catch {
    return false;
  }
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
 * Genera el mensaje de WhatsApp natural para el destinatario (T-361).
 * Redacción clara, humana y concisa según emisor (1ª persona courier vs 3ª persona merchant)
 * y estado individual real (dropStatus si es multi-drop, tripStatus si es legacy single-drop).
 * Sin IDs internos, códigos técnicos ni datos innecesarios (H04 & D3).
 */
export function buildNotifyCustomerWhatsAppMessage(params: NotifyCustomerMessageParams): string {
  const courier = params.courierName?.trim() || 'tu repartidor';

  // 1. Drop con entrega fallida (incluso si el viaje general avanzó)
  if (params.dropStatus === 'failed') {
    if (params.sender === 'merchant') {
      return `¡Hola! Te escribo del comercio. Quería avisarte que ${courier} no pudo completar la entrega de tu pedido. Por favor avisanos para coordinar. ¡Saludos!`;
    }
    return `¡Hola! Soy ${courier}, el repartidor de tu entrega. Quería avisarte que no se pudo completar la entrega de tu pedido. ¡Saludos!`;
  }

  // 2. Entrega completada (drop delivered o single-drop legacy delivered)
  if (
    params.dropStatus === 'delivered' ||
    (params.dropStatus === undefined && params.tripStatus === 'delivered')
  ) {
    if (params.sender === 'merchant') {
      return `¡Hola! Te escribo del comercio. Tu pedido ya fue entregado por ${courier}. ¡Muchas gracias por tu compra!`;
    }
    return `¡Hola! Soy ${courier}, el repartidor de tu entrega. Tu pedido ya fue entregado. ¡Muchas gracias!`;
  }

  // 3. Viaje matched (pre-retiro): pedido asignado, aún no retirado
  if (params.tripStatus === 'matched') {
    if (params.sender === 'merchant') {
      return `¡Hola! Te escribo del comercio. ${courier} es el repartidor asignado a tu pedido y en breve va a retirarlo. ¡Saludos!`;
    }
    return `¡Hola! Soy ${courier}, el repartidor de tu entrega. Ya tengo asignado tu pedido y en breve voy a retirarlo para llevártelo. ¡Nos vemos pronto!`;
  }

  // 4. Viaje in_transit: en recorrido / reparto, sin prometer llegada inminente a un drop específico
  if (params.tripStatus === 'in_transit') {
    if (params.sender === 'merchant') {
      return `¡Hola! Te escribo del comercio. ${courier} ya retiró tu pedido y está en recorrido para la entrega. ¡Saludos!`;
    }
    return `¡Hola! Soy ${courier}, el repartidor de tu entrega. Ya retiré tu pedido y estoy en recorrido para la entrega. ¡Nos vemos pronto!`;
  }

  // Combinación incoherente o desconocida: fallback neutro pre-retiro, nunca asegura "en camino" ni "entregado"
  if (params.sender === 'merchant') {
    return `¡Hola! Te escribo del comercio. ${courier} es el repartidor asignado a tu pedido y en breve va a retirarlo. ¡Saludos!`;
  }
  return `¡Hola! Soy ${courier}, el repartidor de tu entrega. Ya tengo asignado tu pedido y en breve voy a retirarlo para llevártelo. ¡Nos vemos pronto!`;
}
