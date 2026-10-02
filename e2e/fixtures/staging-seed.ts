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
  seedOffersForFirstRequest,
  getRequestInspectionData,
  findRequestIdByNotesMarker,
  cleanupStagingData,
  assertAllowedE2EEnvironment,
  isAllowedE2EEnvironment,
  createE2EClient,
  createAuthenticatedClient,
  generateTotp,
  base32Decode,
  seedAdminUser,
  elevateAdminToAal2,
  seedDeliveryRequestInState,
  type StagingSeedContext,
  type SeedStagingOptions,
  type EnvironmentCheckResult,
  type UserCredentials,
  type RequestFinalInspectionData,
  type SeedRequestInStateOptions,
  type SeedRequestInStateResult,
} from '@/server/e2e/staging-seed';
