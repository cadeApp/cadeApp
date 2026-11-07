import { test, type Page } from '@playwright/test';
import { collectRevealState, inspectStreamingSegments, isStreamingSettled, type StreamingDiagnostics } from './streaming';

export interface WaitForNoSkeletonsOptions {
  timeout?: number;
  selector?: string;
}

// Las funciones viajan al navegador como texto: no pueden usar imports ni closures (ver streaming.ts).
const STREAMING_SETTLED = `(${isStreamingSettled.toString()})(document)`;
const STREAMING_DIAGNOSTICS = `({ ...(${inspectStreamingSegments.toString()})(document), ...(${collectRevealState.toString()})(window) })`;

/**
 * Espera activamente a que los bloques de carga (Skeleton) desaparezcan del DOM o queden ocultos.
 *
 * Cumple estrictamente con el DoD de T-301 y la regla 40 de testing:
 * - Prohibidos los tiempos fijos y pausas arbitrarias.
 * - Monitorea selectores oficiales de cadeApp: .animate-pulse, [aria-busy="true"], [data-slot="skeleton"].
 * - Si no hay skeletons presentes al momento de invocar, resuelve de inmediato sin demoras.
 *
 * T-429: después espera a que React termine el streaming (sin boundaries `B:` ni segmentos pendientes). El `timeout` es
 * para toda la función (PR655-H02): el streaming solo usa lo que dejaron los skeletons. Si queda un segmento huérfano
 * (su boundary ya no existe), lo informa con diagnóstico en la consola y en las anotaciones del test.
 */
export async function waitForNoSkeletons(
  page: Page,
  options: WaitForNoSkeletonsOptions = {}
): Promise<void> {
  const timeout = options.timeout ?? 15_000;
  const selector =
    options.selector ?? '.animate-pulse, [aria-busy="true"], [data-slot="skeleton"]';

  const deadline = performance.now() + timeout;

  // Ningún skeleton visible: resuelve de inmediato si no hay, o cuando todos se van o quedan ocultos.
  await page.locator(selector).filter({ visible: true }).first().waitFor({ state: 'detached', timeout });

  const remaining = Math.floor(deadline - performance.now());
  if (remaining <= 0) {
    // Nunca timeout 0: en Playwright eso desactiva el límite.
    throw new Error(`waitForNoSkeletons: timeout de ${timeout}ms agotado por los skeletons, antes del streaming`);
  }
  await page.waitForFunction(STREAMING_SETTLED, undefined, { timeout: remaining });
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
