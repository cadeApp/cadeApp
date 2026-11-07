import { test, type Page } from '@playwright/test';
import { collectRevealState, inspectStreamingSegments, type StreamingDiagnostics } from './streaming';

export interface WaitForNoSkeletonsOptions {
  timeout?: number;
  selector?: string;
}

// Las funciones viajan al navegador como texto: no pueden usar imports ni closures (ver streaming.ts).
const NO_PENDING_SEGMENTS = `(${inspectStreamingSegments.toString()})(document).pending.length === 0`;
const STREAMING_DIAGNOSTICS = `({ ...(${inspectStreamingSegments.toString()})(document), ...(${collectRevealState.toString()})(window) })`;

/**
 * Espera activamente a que los bloques de carga (Skeleton) desaparezcan del DOM o queden ocultos.
 *
 * Cumple estrictamente con el DoD de T-301 y la regla 40 de testing:
 * - Prohibidos los tiempos fijos y pausas arbitrarias.
 * - Monitorea selectores oficiales de cadeApp: .animate-pulse, [aria-busy="true"], [data-slot="skeleton"].
 * - Si no hay skeletons presentes al momento de invocar, resuelve de inmediato sin demoras.
 *
 * T-429: después espera, con el mismo timeout, a que React revele los segmentos de streaming pendientes. Si queda un
 * segmento huérfano (su boundary ya no existe), lo informa con diagnóstico en la consola y en las anotaciones del test.
 */
export async function waitForNoSkeletons(
  page: Page,
  options: WaitForNoSkeletonsOptions = {}
): Promise<void> {
  const timeout = options.timeout ?? 15_000;
  const selector =
    options.selector ?? '.animate-pulse, [aria-busy="true"], [data-slot="skeleton"]';

  // waitForSelector con state: 'detached' espera hasta que el elemento no esté en el DOM.
  // Si ya no existe, Playwright resuelve de inmediato sin esperar el timeout.
  await page.waitForSelector(selector, { state: 'detached', timeout }).catch(async () => {
    // Si sigue en el DOM pero con visibilidad oculta, valida state: 'hidden'
    await page.waitForSelector(selector, { state: 'hidden', timeout });
  });

  await page.waitForFunction(NO_PENDING_SEGMENTS, undefined, { timeout });
  await reportOrphanedSegments(page);
}

/** T-429 (fase 1): junta el dato del gate para decidir D01; no falla la prueba. */
async function reportOrphanedSegments(page: Page): Promise<void> {
  const diagnostics = await page.evaluate<StreamingDiagnostics>(STREAMING_DIAGNOSTICS).catch(() => null);
  if (!diagnostics || diagnostics.orphaned.length === 0) return;

  const description = JSON.stringify({ url: page.url(), ...diagnostics });
  console.warn(`[T-429 streaming] segmento huérfano ${description}`);
  try {
    test.info().annotations.push({ type: 'T-429 streaming', description });
  } catch {
    // Fuera de un test (por ejemplo en un setup global) no hay anotaciones: alcanza con la consola.
  }
}
