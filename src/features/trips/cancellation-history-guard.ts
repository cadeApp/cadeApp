import type { RequestCancellationHistory } from '@/domain';
import type { CancellationHistoryResult } from './components/cancellation-history-card';

/**
 * T-373 / PR425-H04: el historial no se pudo leer por una falla. Se lanza para que llegue al `error.tsx` de la ruta;
 * el mensaje es fijo y no lleva ids, mensajes de PostgreSQL ni datos del pedido.
 */
export class CancellationHistoryUnavailableError extends Error {
  constructor() {
    super('CANCELLATION_HISTORY_UNAVAILABLE');
    this.name = 'CancellationHistoryUnavailableError';
  }
}

/**
 * T-373 / 5-A: decide qué ve en `/trips/[id]` un repartidor sin viaje visible (ya no está asignado).
 * - Historial con eventos propios: la vista «Cancelaste esta asignación».
 * - Ausencia (NOT_FOUND, sin eventos, id inválido, actor sin permiso o sin sesión): `onAbsent` (el 404), sin revelar
 *   si el pedido existe ni si otros repartidores cancelaron.
 * - Falla (INTERNAL_ERROR): lanza, nunca se convierte en 404.
 */
export function selectCourierCancelledAssignment(
  result: CancellationHistoryResult,
  onAbsent: () => never
): RequestCancellationHistory {
  if (result.ok) {
    return result.data.events.length > 0 ? result.data : onAbsent();
  }
  if (result.code === 'INTERNAL_ERROR') throw new CancellationHistoryUnavailableError();
  return onAbsent();
}
