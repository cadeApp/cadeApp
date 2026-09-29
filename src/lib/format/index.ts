const ARGENTINA_TIMEZONE = 'America/Argentina/Buenos_Aires';

const arsNumberFormatter = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const datePartsFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: ARGENTINA_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Formatea un monto entero en pesos argentinos (ARS) sin decimales,
 * con separador de miles con punto y espacio tras el signo: "$ 1.500".
 */
export function formatArs(amountArs: number): string {
  if (!Number.isFinite(amountArs) || !Number.isInteger(amountArs) || amountArs < 0) {
    throw new RangeError(
      `Monto en ARS inválido (${String(amountArs)}): debe ser un entero no negativo.`
    );
  }

  return `$ ${arsNumberFormatter.format(amountArs)}`;
}

export type DateFormatMode = 'dateTime' | 'date' | 'time';

/**
 * Formatea una fecha/hora siempre en la zona horaria oficial de Argentina
 * (`America/Argentina/Buenos_Aires`, UTC-3), independientemente del huso del servidor o cliente.
 */
export function formatDate(
  dateInput: Date | string | number,
  mode: DateFormatMode = 'dateTime'
): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Fecha inválida: ${String(dateInput)}`);
  }

  const parts = datePartsFormatter.formatToParts(date);
  const byType = new Map<string, string>();
  for (const part of parts) {
    byType.set(part.type, part.value);
  }

  const day = byType.get('day') ?? '01';
  const month = byType.get('month') ?? '01';
  const year = byType.get('year') ?? '1970';
  const rawHour = byType.get('hour') ?? '00';
  const hour = rawHour === '24' ? '00' : rawHour;
  const minute = byType.get('minute') ?? '00';

  const datePart = `${day}/${month}/${year}`;
  const timePart = `${hour}:${minute}`;

  if (mode === 'date') {
    return datePart;
  }
  if (mode === 'time') {
    return timePart;
  }
  return `${datePart} ${timePart}`;
}

/**
 * Extrae los 10 dígitos nacionales de un número móvil argentino (ej. 3865123456),
 * limpiando prefijos internacionales (+54, 549), 0 de larga distancia y 15 móvil.
 */
function extractNationalTenDigits(rawPhone: string): string {
  let digits = rawPhone.replace(/\D/g, '');

  if (digits.startsWith('549') && digits.length >= 13) {
    digits = digits.slice(3);
  } else if (digits.startsWith('54') && digits.length >= 12) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Si tiene 12 dígitos por el "15" intermedio tras un prefijo de 4 dígitos (ej. 3865 15 123456)
  if (digits.length === 12 && digits.slice(4, 6) === '15') {
    digits = `${digits.slice(0, 4)}${digits.slice(6)}`;
  } else if (digits.length === 12 && digits.slice(3, 5) === '15') {
    digits = `${digits.slice(0, 3)}${digits.slice(5)}`;
  }

  if (digits.length < 8) {
    throw new RangeError(`Número de teléfono inválido: ${rawPhone}`);
  }

  return digits;
}

/**
 * Formatea un teléfono argentino para lectura clara en pantalla (ej. "3865 12-3456").
 */
export function formatPhone(rawPhone: string): string {
  const digits = extractNationalTenDigits(rawPhone);

  if (digits.length === 10) {
    // Códigos de área de 4 dígitos del interior (ej. 3865 Aguilares) + 6 dígitos locales (XX-XXXX)
    return `${digits.slice(0, 4)} ${digits.slice(4, 6)}-${digits.slice(6)}`;
  }

  return digits;
}

/**
 * Construye un enlace oficial de WhatsApp (`https://wa.me/549...`) sin exponer datos en logs.
 */
export function whatsappLink(rawPhone: string, message?: string): string {
  const digits = extractNationalTenDigits(rawPhone);
  const international = `549${digits}`;
  const baseUrl = `https://wa.me/${international}`;

  if (!message || message.trim().length === 0) {
    return baseUrl;
  }

  return `${baseUrl}?text=${encodeURIComponent(message)}`;
}
