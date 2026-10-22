/**
 * T-393: resultado real de las entregas de una solicitud. CC-022 §6 cierra la solicitud en `delivered` cuando no
 * quedan entregas `pending`, aunque alguna haya quedado `failed`; las vistas del comercio leen este resumen para no
 * dar a entender que todo se entregó.
 */

export type DropOutcomeStatus = 'pending' | 'delivered' | 'failed';

export type DropOutcome = 'all_delivered' | 'partial' | 'none_delivered' | 'in_progress';

export interface DropOutcomeSummary {
  readonly outcome: DropOutcome;
  readonly total: number;
  readonly delivered: number;
  readonly failed: number;
  readonly pending: number;
}

/** Estado de una entrega leído como texto (lecturas del historial); un valor desconocido cuenta como pendiente. */
export function toDropOutcomeStatus(status: string | undefined): DropOutcomeStatus {
  return status === 'delivered' || status === 'failed' ? status : 'pending';
}

/**
 * Con entregas, cuenta por el estado de cada una. Sin entregas (modelo legacy), la única entrega toma el estado de la
 * solicitud.
 */
export function summarizeDropOutcome(
  drops: readonly { readonly status: DropOutcomeStatus }[] | undefined,
  requestStatus: string
): DropOutcomeSummary {
  const isClosed = requestStatus === 'delivered';

  if (!drops || drops.length === 0) {
    return {
      outcome: isClosed ? 'all_delivered' : 'in_progress',
      total: 1,
      delivered: isClosed ? 1 : 0,
      failed: 0,
      pending: isClosed ? 0 : 1,
    };
  }

  const delivered = drops.filter((d) => d.status === 'delivered').length;
  const failed = drops.filter((d) => d.status === 'failed').length;
  const pending = drops.length - delivered - failed;

  let outcome: DropOutcome = 'in_progress';
  if (isClosed) {
    if (delivered === 0) outcome = 'none_delivered';
    else if (failed > 0) outcome = 'partial';
    else outcome = 'all_delivered';
  }

  return { outcome, total: drops.length, delivered, failed, pending };
}
