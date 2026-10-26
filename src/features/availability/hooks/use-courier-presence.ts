'use client';

import * as React from 'react';
import { courierHeartbeatAction } from '../actions';

/** CC-041: cada cuánto avisa la app que el repartidor sigue conectado (la ventana por defecto es de 10 minutos). */
export const PRESENCE_INTERVAL_MS = 120_000;

/**
 * T-415: mientras «Disponible» está prendido y la pantalla visible, manda la señal de presencia al prender, cada
 * PRESENCE_INTERVAL_MS y al volver a la pantalla. Es best-effort: una falla no molesta al repartidor ni corta las
 * siguientes señales. La hora la pone la base.
 */
export function useCourierPresence(
  available: boolean,
  send: () => Promise<unknown> = courierHeartbeatAction
): void {
  React.useEffect(() => {
    if (!available) return undefined;

    const beat = () => {
      if (document.visibilityState !== 'visible') return;
      // Best-effort: un error (sincrónico o de la promesa) no molesta; la próxima señal lo vuelve a intentar.
      try {
        void Promise.resolve(send()).catch(() => undefined);
      } catch {
        // Igual que arriba: se ignora.
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') beat();
    };

    beat();
    const interval = window.setInterval(beat, PRESENCE_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [available, send]);
}
