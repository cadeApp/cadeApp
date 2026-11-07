import { z } from 'zod';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

/**
 * WhatsApp del soporte de cadeApp con un mensaje prearmado. El número viene del servidor
 * (`CADEAPP_SUPPORT_WHATSAPP_NUMBER`); sin un número válido devuelve `null`: nunca se construye un wa.me sin
 * destinatario.
 */
export function buildSupportWhatsAppHref(rawPhone: string | undefined, message: string): string | null {
  const parsed = z.string().trim().regex(/^[+()\d\s-]{10,32}$/).safeParse(rawPhone);
  if (!parsed.success) return null;

  // Un prefijo internacional parcial no puede tratarse como diez dígitos nacionales.
  // El helper compartido acepta dígitos sin prefijo: comprobamos aquí la forma internacional.
  const digits = parsed.data.replace(/\D/g, '');
  const incompleteInternationalPrefix = digits.startsWith('549')
    ? digits.length !== 13
    : digits.startsWith('54') && digits.length !== 12;
  if (incompleteInternationalPrefix) {
    return null;
  }

  try {
    return buildWhatsAppUrl(parsed.data, message);
  } catch {
    // El helper también comprueba que el número nacional argentino tenga 10 dígitos.
    return null;
  }
}
