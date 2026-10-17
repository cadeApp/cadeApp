import 'server-only';
import { z } from 'zod';
import type { createAdminClient } from '@/server/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

/** Mismo enum que `COURIER_DOCS_ORPHAN_PURGE_MODE` en `src/server/env.ts`. */
export type OrphanPurgeMode = 'off' | 'dry-run' | 'enforce';

export interface OrphanCourierDocumentsResult {
  readonly mode: OrphanPurgeMode;
  readonly candidateCount: number;
  readonly claimedCount: number;
  readonly removedCount: number;
  readonly completedCount: number;
  readonly pendingCount: number;
  readonly skippedLockedCount: number;
}

const COURIER_DOCS_BUCKET = 'courier-docs';
const ORPHAN_CLAIM_LIMIT = 100;
const MAX_ORPHAN_CLAIM_BATCHES = 3;

const claimResultSchema = z.object({
  dryRun: z.boolean(),
  candidateCount: z.number().int().min(0).max(ORPHAN_CLAIM_LIMIT),
  claimed: z
    .array(
      z.object({
        claimId: z.string().uuid(),
        storagePath: z.string().min(1),
      })
    )
    .max(ORPHAN_CLAIM_LIMIT),
  skippedLockedCount: z.number().int().min(0),
  hasMore: z.boolean(),
});

const completeResultSchema = z.object({
  completedCount: z.number().int().min(0),
  pendingCount: z.number().int().min(0),
});

/**
 * CC-030: purga objetos de courier-docs que ninguna fila de courier_documents referencia. La elegibilidad
 * (ventana de gracia, revalidación bajo lock y barrera contra writers) vive en PostgreSQL; acá sólo se borra
 * lo que la RPC reclamó y se confirma contra Storage. Nunca registra rutas ni datos personales.
 */
export async function reconcileOrphanCourierDocuments(
  supabase: AdminClient,
  mode: OrphanPurgeMode
): Promise<OrphanCourierDocumentsResult> {
  let candidateCount = 0;
  let claimedCount = 0;
  let removedCount = 0;
  let completedCount = 0;
  let pendingCount = 0;
  let skippedLockedCount = 0;

  if (mode === 'off') {
    return { mode, candidateCount, claimedCount, removedCount, completedCount, pendingCount, skippedLockedCount };
  }

  const dryRun = mode === 'dry-run';

  for (let batch = 0; batch < MAX_ORPHAN_CLAIM_BATCHES; batch += 1) {
    const { data: claimData, error: claimError } = await supabase.rpc(
      'claim_orphan_courier_documents',
      { p_limit: ORPHAN_CLAIM_LIMIT, p_dry_run: dryRun }
    );
    if (claimError) {
      throw new Error('Failed to claim orphan courier documents');
    }
    const parsedClaim = claimResultSchema.safeParse(claimData);
    if (!parsedClaim.success || parsedClaim.data.dryRun !== dryRun) {
      throw new Error('Failed to claim orphan courier documents: invalid RPC response');
    }
    const claim = parsedClaim.data;

    candidateCount += claim.candidateCount;
    skippedLockedCount += claim.skippedLockedCount;

    // El dry-run no reclama, así que repetir la lectura devolvería los mismos candidatos.
    if (dryRun) break;

    if (claim.claimed.length > 0) {
      claimedCount += claim.claimed.length;
      const { data: removed, error: removeError } = await supabase.storage
        .from(COURIER_DOCS_BUCKET)
        .remove(claim.claimed.map((item) => item.storagePath));
      if (removeError) {
        // Los reclamos quedan pendientes y la próxima ejecución los reintenta.
        throw new Error('Failed to remove orphan courier documents');
      }
      removedCount += removed?.length ?? 0;
    }

    if (!claim.hasMore || claim.claimed.length === 0) break;
  }

  if (!dryRun) {
    // Confirma sólo lo que Storage ya no tiene; también recupera confirmaciones de corridas anteriores.
    const { data: completeData, error: completeError } = await supabase.rpc(
      'complete_orphan_courier_document_purge'
    );
    if (completeError) {
      throw new Error('Failed to complete orphan courier document purge');
    }
    const parsedComplete = completeResultSchema.safeParse(completeData);
    if (!parsedComplete.success) {
      throw new Error('Failed to complete orphan courier document purge: invalid RPC response');
    }
    completedCount = parsedComplete.data.completedCount;
    pendingCount = parsedComplete.data.pendingCount;
  }

  const result = {
    mode,
    candidateCount,
    claimedCount,
    removedCount,
    completedCount,
    pendingCount,
    skippedLockedCount,
  };
  console.info('[cron/sweep] huérfanos de courier-docs', result);
  return result;
}
