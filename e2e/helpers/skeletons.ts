import type { Page } from '@playwright/test';

export interface WaitForNoSkeletonsOptions {
  timeout?: number;
  selector?: string;
}

/**
 * Espera activamente a que los bloques de carga (Skeleton) desaparezcan del DOM o queden ocultos.
 *
 * Cumple estrictamente con el DoD de T-301 y la regla 40 de testing:
 * - Prohibidos los tiempos fijos y pausas arbitrarias.
 * - Monitorea selectores oficiales de cadeApp: .animate-pulse, [aria-busy="true"], [data-slot="skeleton"].
 * - Si no hay skeletons presentes al momento de invocar, resuelve de inmediato sin demoras.
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
}
