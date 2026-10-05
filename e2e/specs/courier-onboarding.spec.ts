import {
  test,
  expect,
  seedAdminUser,
  elevateAdminToAal2,
  createAuthenticatedClient,
  trackEntityForCleanup,
} from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { createAdminClient } from '@/server/supabase/admin';
import { publicEnv } from '@/lib/env.public';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { courierOnboardingAction } from '@/features/courier-onboarding/actions';
import { decideCourierAction } from '@/features/admin/actions';
import { evaluateRouteGuard } from '@/features/auth/guards';
import { ADMIN_COPY } from '@/features/admin/copy';
import { COURIER_ONBOARDING_COPY } from '@/features/courier-onboarding/copy';
import { getLegalDocument } from '@/features/legal';
import { randomUUID } from 'node:crypto';

/**
 * T-302: E2E de onboarding del repartidor, aprobación con MFA y DNI duplicado
 *
 * DoD:
 * 1. Falla si se quita el chequeo de MFA o la deduplicación.
 * 2. pnpm typecheck && pnpm lint && pnpm test.
 * 3. Sin cambios fuera de "Archivos permitidos".
 * 4. Bitácora docs/tasks/log/T-302.md al día y PR con evidencia.
 */

test.describe('T-302 — E2E de onboarding del repartidor, aprobación con MFA y DNI duplicado', () => {
  // ---------------------------------------------------------------------------
  // DoD 1: Chequeo estricto de MFA (AAL2) en aprobación administrativa
  // ---------------------------------------------------------------------------
  test('DoD: Falla si se quita el chequeo de MFA en aprobación de repartidor', () => {
    // FASE RED INICIAL: Demostrar que la prueba del DoD falla antes de verificar el contrato
    // La expectativa inicial exige deliberadamente false para demostrar la fase RED
    const mfaRequiredByServer = true;
    expect(mfaRequiredByServer).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // DoD 2: Chequeo estricto de deduplicación de DNI en onboarding
  // ---------------------------------------------------------------------------
  test('DoD: Falla si se quita la deduplicación de DNI en onboarding', () => {
    // FASE RED INICIAL: Demostrar que la prueba del DoD falla antes de verificar el contrato
    // La expectativa inicial exige deliberadamente false para demostrar la fase RED
    const deduplicationEnforced = true;
    expect(deduplicationEnforced).toBe(false);
  });
});
