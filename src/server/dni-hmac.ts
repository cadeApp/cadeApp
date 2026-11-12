import 'server-only';
import { createHmac } from 'node:crypto';

/**
 * HMAC-SHA256 del DNI con el secreto del servidor (`DNI_HMAC_SECRET`). Normaliza a solo dígitos, así «38.123.456» y
 * «38123456» dan el mismo hash. Lo usan el alta del repartidor y la búsqueda de reservas del admin (CC-050).
 */
export function computeDniHmac(dni: string, secret: string): string {
  const normalizedDni = dni.replace(/\D/g, '');
  return createHmac('sha256', secret).update(normalizedDni).digest('hex');
}
