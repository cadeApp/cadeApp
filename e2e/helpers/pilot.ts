import { createAdminClient } from '@/server/supabase/admin';
import type { Json } from '@/types/database.types';

/**
 * T-375: manejo de `platform_settings.pilot_active` para las suites global-settings.
 *
 * En Develop el piloto encendido es un invariante operativo, así que se restaura siempre a ese valor base y nunca a un
 * valor leído al empezar cada prueba (si una corrida anterior lo dejó apagado, ese «original» ya está sucio).
 *
 * La restauración no puede vivir solo en un `finally` del cuerpo de la prueba: cuando Playwright corta la prueba por
 * timeout, la promesa del cuerpo nunca se resuelve y ese `finally` no se ejecuta. Por eso cada spec registra
 * `restore()` en `test.afterEach` (Playwright lo corre también después de un timeout, con su propio tiempo) y en
 * `test.afterAll` de respaldo.
 */

/** Valor que Develop mantiene en `pilot_active` (ver `publication-credits.spec.ts`, proyecto chromium). */
export const PILOT_BASELINE = true;

export interface PilotStore {
  read(): Promise<boolean>;
  write(active: boolean): Promise<void>;
}

export interface PilotGuard {
  /** Precondición fail-closed: el piloto tiene que estar en el valor base. Si no, falla sin escribir nada. */
  assertBaseline(): Promise<void>;
  read(): Promise<boolean>;
  /** Fija el piloto. Asume la responsabilidad de restaurarlo antes de escribir. */
  set(active: boolean): Promise<void>;
  /** Vuelve al valor base y lo verifica, solo si esta suite asumió la responsabilidad de haberlo cambiado. */
  restore(): Promise<void>;
}

export function createPilotGuard(store: PilotStore, label: string): PilotGuard {
  let baselineVerified = false;
  let mustRestore = false;

  return {
    async assertBaseline() {
      baselineVerified = false;
      const current = await store.read();
      if (current !== PILOT_BASELINE) {
        throw new Error(
          `[${label}] pilot_active=${current} al empezar la suite; se espera ${PILOT_BASELINE}. ` +
            'No se repara automáticamente: otra corrida lo dejó sucio, avisá a Lautaro073.'
        );
      }
      baselineVerified = true;
    },

    read: () => store.read(),

    async set(active) {
      if (!baselineVerified) {
        throw new Error(`[${label}] No se verificó pilot_active=${PILOT_BASELINE} antes de modificarlo.`);
      }
      // Antes de escribir: si la escritura se aplica pero falla la respuesta, igual se restaura.
      mustRestore = true;
      await store.write(active);
    },

    async restore() {
      if (!mustRestore) return;
      await store.write(PILOT_BASELINE);
      const restored = await store.read();
      if (restored !== PILOT_BASELINE) {
        throw new Error(`[${label}] pilot_active no volvió a ${PILOT_BASELINE} (quedó en ${restored}).`);
      }
      mustRestore = false;
    },
  };
}

/** Almacén real: `platform_settings` de la base del ambiente, con service role (solo en el runner de E2E). */
export function createSupabasePilotStore(label: string): PilotStore {
  return {
    async read() {
      const { data, error } = await createAdminClient()
        .from('platform_settings')
        .select('value')
        .eq('key', 'pilot_active')
        .single();
      if (error || !data || typeof data.value !== 'boolean') {
        throw new Error(`[${label}] No se pudo leer pilot_active: ${error?.message ?? 'valor no booleano'}`);
      }
      return data.value;
    },

    async write(active) {
      const { data, error } = await createAdminClient()
        .from('platform_settings')
        .update({ value: active as unknown as Json })
        .eq('key', 'pilot_active')
        .select('value')
        .single();
      if (error || !data || data.value !== active) {
        throw new Error(`[${label}] No se pudo fijar pilot_active=${active}: ${error?.message ?? 'no quedó aplicado'}`);
      }
    },
  };
}
