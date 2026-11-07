/**
 * T-429: segmentos de streaming de React (Suspense) en el DOM.
 *
 * El servidor manda el contenido de un boundary en `<div hidden id="S:n">` y deja `<template id="B:n">` donde va.
 * React lo revela con `$RC`/`$RV`, que borran el `S:`. Un segmento cuyo `B:` todavía existe está **pendiente**; uno
 * cuyo `B:` ya no existe quedó **huérfano** (el boundary se resolvió por otro camino y nadie lo borró). El huérfano es
 * invisible, pero el modo estricto de Playwright cuenta su texto y duplica coincidencias.
 */
export interface StreamingSegmentsState {
  readonly pending: readonly string[];
  readonly orphaned: readonly string[];
}

/**
 * Clasifica los segmentos `S:` del documento. Se ejecuta tal cual en el navegador (vía `toString()`) y en jsdom:
 * sin imports, closures ni helpers.
 */
export function inspectStreamingSegments(doc: Document): StreamingSegmentsState {
  const pending: string[] = [];
  const orphaned: string[] = [];
  doc.querySelectorAll('div[hidden][id^="S:"]').forEach((segment) => {
    const boundaryId = 'B:' + segment.id.slice(2);
    if (doc.getElementById(boundaryId)) {
      pending.push(segment.id);
    } else {
      orphaned.push(segment.id);
    }
  });
  return { pending, orphaned };
}

export interface RevealState {
  readonly visibilityState: string;
  /** `typeof $RT`: React lo setea en el primer `requestAnimationFrame` del revelado. */
  readonly revealTimerType: string;
  /** `$RB.length`: boundaries encolados que `$RV` todavía no reveló (`null` si no existe). */
  readonly revealQueueLength: number | null;
}

export type StreamingDiagnostics = StreamingSegmentsState & RevealState;

/** Estado de la pestaña y de la cola de revelado de React, para el diagnóstico de un huérfano. Igual que arriba: autocontenida. */
export function collectRevealState(win: Window): RevealState {
  const globals = win as unknown as Record<string, unknown>;
  const queue = globals['$RB'];
  return {
    visibilityState: win.document.visibilityState,
    revealTimerType: typeof globals['$RT'],
    revealQueueLength: Array.isArray(queue) ? queue.length : null,
  };
}

/**
 * PR655-H01: el streaming terminó cuando no queda ningún boundary `B:` (un `B:` aislado espera un segmento que todavía
 * no llegó) ni segmentos pendientes. Un `S:` huérfano, sin su `B:`, no bloquea. Autocontenida, igual que las demás.
 */
export function isStreamingSettled(doc: Document): boolean {
  if (doc.querySelector('template[id^="B:"]')) return false;
  let pending = 0;
  doc.querySelectorAll('div[hidden][id^="S:"]').forEach((segment) => {
    if (doc.getElementById('B:' + segment.id.slice(2))) pending += 1;
  });
  return pending === 0;
}
