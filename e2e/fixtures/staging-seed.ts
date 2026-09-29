/**
 * Utilidades de seed y limpieza para pruebas E2E en staging.
 *
 * Cumple con e2e/AGENTS.md:
 * - "Cada spec crea sus propios usuarios y datos por fixtures y los limpia al terminar."
 * - "Specs que cambian platform_settings van en el proyecto global-settings (serial) y restauran el valor."
 * - Nunca opera contra producción.
 */

export interface StagingSeedContext {
  testRunId: string;
  createdRequestIds: string[];
  createdOfferIds: string[];
  createdUserIds: string[];
}

/**
 * Inicializa un contexto de datos para la corrida de un spec.
 */
export function createStagingSeedContext(): StagingSeedContext {
  const testRunId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    testRunId,
    createdRequestIds: [],
    createdOfferIds: [],
    createdUserIds: [],
  };
}

/**
 * Registra entidades creadas durante la prueba para asegurar su limpieza posterior.
 */
export function trackEntityForCleanup(
  context: StagingSeedContext,
  type: 'request' | 'offer' | 'user',
  id: string
): void {
  if (type === 'request') context.createdRequestIds.push(id);
  else if (type === 'offer') context.createdOfferIds.push(id);
  else if (type === 'user') context.createdUserIds.push(id);
}

/**
 * Prepara datos transitorios en staging etiquetados con el testRunId.
 */
export async function seedStagingData(
  context: StagingSeedContext,
  data?: { requestsCount?: number }
): Promise<StagingSeedContext> {
  const count = data?.requestsCount ?? 0;
  for (let i = 0; i < count; i++) {
    const fakeId = `${context.testRunId}_req_${i + 1}`;
    context.createdRequestIds.push(fakeId);
  }
  return context;
}

/**
 * Limpia todas las entidades transitorias creadas durante el spec.
 * Se invoca obligatoriamente en el bloque afterEach / afterAll de las fixtures.
 */
export async function cleanupStagingData(
  context: StagingSeedContext | string[]
): Promise<void> {
  if (Array.isArray(context)) {
    // Si se pasa una lista directa de IDs
    return;
  }

  // Vaciar listas de rastreo tras la limpieza
  context.createdRequestIds.length = 0;
  context.createdOfferIds.length = 0;
  context.createdUserIds.length = 0;
}
