import { expect, type Locator } from '@playwright/test';

/**
 * Bandera que `waitForFormHydration` deja en `window` apenas empieza a esperar. Solo la lee
 * `e2e/specs/login.spec.ts` (T-337) para comprobar, sin tiempos fijos, que nada se completó ni se envió
 * antes de que React hidratara el formulario.
 */
export const HYDRATION_WAIT_FLAG = '__cadeE2eAwaitingHydration';

export interface WaitForFormHydrationOptions {
  timeout?: number;
}

/**
 * Espera a que React hidrate el `<form>` que contiene `control`.
 *
 * `goto` espera `load`, pero Next 15 + React 18 hidratan en modo concurrente y pueden terminar después. Antes de
 * eso, un click hace un submit nativo y lo que se tipea no llega al estado de los inputs controlados (T-337).
 * React 18 adjunta `__reactProps$<id>` a cada nodo que hidrata: el formulario está listo cuando esas props
 * tienen su `onSubmit`.
 */
export async function waitForFormHydration(
  control: Locator,
  options: WaitForFormHydrationOptions = {}
): Promise<void> {
  await expect
    .poll(
      () =>
        control.evaluate((element, flag) => {
          Reflect.set(window, flag, true);
          const form = element.closest('form');
          if (!form) return false;
          const propsKey = Object.keys(form).find((key) => key.startsWith('__reactProps$'));
          if (!propsKey) return false;
          const props: unknown = Reflect.get(form, propsKey);
          return (
            typeof props === 'object' &&
            props !== null &&
            typeof Reflect.get(props, 'onSubmit') === 'function'
          );
        }, HYDRATION_WAIT_FLAG),
      {
        timeout: options.timeout ?? 30_000,
        message: 'El formulario no se hidrató: React no adjuntó su onSubmit',
      }
    )
    .toBe(true);
}
