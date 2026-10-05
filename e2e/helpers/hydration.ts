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
 *
 * El formulario está listo cuando se cumplen las dos condiciones:
 * 1. sus props de React (`__reactProps$<id>`) tienen `onSubmit`;
 * 2. su Fiber (`__reactFiber$<id>`) ya está montado.
 *
 * Las props solas no alcanzan (PR255-H01): React las escribe en `hydrateInstance`, antes del commit, y mientras
 * el Fiber conserve `Placement | Hydrating` el despachador de eventos ignora el target.
 *
 * Internals de React 18.3.1, encapsulados solo acá: las keys `__reactProps$` / `__reactFiber$`, los flags
 * `Placement = 2` y `Hydrating = 4096`, el tag `HostRoot = 3` y el criterio de `getNearestMountedFiber`
 * (`ReactFiberTreeReflection`). Si se actualiza React, revisar estos valores.
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

          const keys = Object.keys(form);
          const propsKey = keys.find((key) => key.startsWith('__reactProps$'));
          if (!propsKey) return false;
          const props: unknown = Reflect.get(form, propsKey);
          if (
            typeof props !== 'object' ||
            props === null ||
            typeof Reflect.get(props, 'onSubmit') !== 'function'
          ) {
            return false;
          }

          const fiberKey = keys.find((key) => key.startsWith('__reactFiber$'));
          if (!fiberKey) return false;
          const fiber: unknown = Reflect.get(form, fiberKey);
          if (typeof fiber !== 'object' || fiber === null) return false;

          // React 18.3.1: ReactFiberFlags / ReactWorkTags.
          const PLACEMENT = 2;
          const HYDRATING = 4096;
          const HOST_ROOT = 3;
          // Corte defensivo: un `.return` cíclico no puede colgar el polling.
          const MAX_DEPTH = 10_000;

          const parent = (node: object): object | null => {
            const next: unknown = Reflect.get(node, 'return');
            return typeof next === 'object' ? next : null;
          };
          const flagsOf = (node: object): number => {
            const value: unknown = Reflect.get(node, 'flags');
            return typeof value === 'number' ? value : 0;
          };

          // Equivalente a getNearestMountedFiber(fiber) === fiber.
          let node: object = fiber;
          let nearestMounted: object | null = fiber;
          let depth = 0;
          const alternate: unknown = Reflect.get(fiber, 'alternate');
          if (typeof alternate !== 'object' || alternate === null) {
            // Fiber nuevo: sigue en inserción/hidratación mientras él o un ancestro tenga Placement | Hydrating.
            let next: object | null = node;
            do {
              node = next;
              if ((flagsOf(node) & (PLACEMENT | HYDRATING)) !== 0) {
                nearestMounted = parent(node);
              }
              next = parent(node);
              depth += 1;
            } while (next && depth < MAX_DEPTH);
          } else {
            // Fiber con alternate: ya se commiteó al menos una vez; solo tiene que colgar de un HostRoot.
            let next = parent(node);
            while (next && depth < MAX_DEPTH) {
              node = next;
              next = parent(node);
              depth += 1;
            }
          }
          if (depth >= MAX_DEPTH) return false;
          if (Reflect.get(node, 'tag') !== HOST_ROOT) return false;
          return nearestMounted === fiber;
        }, HYDRATION_WAIT_FLAG),
      {
        timeout: options.timeout ?? 30_000,
        message: 'El formulario no se hidrató: falta el onSubmit de React o su Fiber todavía no está montado',
      }
    )
    .toBe(true);
}
