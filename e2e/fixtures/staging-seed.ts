/**
 * Utilidades de seed y limpieza para pruebas E2E en staging.
 * Delega a la capa de servidor src/server/e2e/staging-seed.ts garantizando:
 * - Operación real contra Supabase staging vía createAdminClient()
 * - Service-role confinado exclusivamente al servidor
 * - Rastreo estricto de entidades por corrida única (testRunId)
 * - Protección Fail-Closed contra ejecución inadvertida en producción
 * - Limpieza relacional inversa y tolerancia a fallos parciales
 */

export {
  createStagingSeedContext,
  trackEntityForCleanup,
  seedStagingData,
  cleanupStagingData,
  assertAllowedE2EEnvironment,
  isAllowedE2EEnvironment,
  type StagingSeedContext,
  type SeedStagingOptions,
  type EnvironmentCheckResult,
} from '@/server/e2e/staging-seed';
