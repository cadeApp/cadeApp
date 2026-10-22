import 'server-only';
import { createAdminClient } from '@/server/supabase/admin';
import { canMerchantPublishRequest } from '@/domain/states';
import { safeNotifyPostTransition } from '@/server/push';
import { serverEnv } from '@/server/env';
import {
  reconcileOrphanCourierDocuments,
  type OrphanCourierDocumentsResult,
} from './orphan-courier-documents';

export interface SweepResult {
  expiredRequestsCount: number;
  purgedDocsCount: number;
  expiredSubscriptionsCount: number;
  orphanCourierDocuments: OrphanCourierDocumentsResult;
}

const RECONCILE_EXPIRED_REQUESTS_CRON_LIMIT = 200;
const MAX_RECONCILE_EXPIRED_REQUESTS_CRON_BATCHES = 5;

interface ReconcileExpiredRequestsCronResult {
  readonly expiredRequestIds: readonly string[];
  readonly expiredOfferCourierIdsByRequest: Readonly<Record<string, readonly string[]>>;
  readonly expiredCount: number;
  readonly hasMore: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseReconcileExpiredRequestsCronResult(
  value: unknown
): ReconcileExpiredRequestsCronResult | null {
  if (!isRecord(value)) return null;
  const requestIds = value.expiredRequestIds;
  const courierIdsByRequest = value.expiredOfferCourierIdsByRequest;
  if (
    !Array.isArray(requestIds) ||
    !requestIds.every((requestId) => typeof requestId === 'string') ||
    new Set(requestIds).size !== requestIds.length ||
    !Number.isInteger(value.expiredCount) ||
    value.expiredCount !== requestIds.length ||
    value.expiredCount < 0 ||
    value.expiredCount > RECONCILE_EXPIRED_REQUESTS_CRON_LIMIT ||
    typeof value.hasMore !== 'boolean' ||
    !isRecord(courierIdsByRequest)
  ) {
    return null;
  }

  const knownRequestIds = new Set(requestIds);
  for (const [requestId, courierIds] of Object.entries(courierIdsByRequest)) {
    if (
      !knownRequestIds.has(requestId) ||
      !Array.isArray(courierIds) ||
      !courierIds.every((courierId) => typeof courierId === 'string') ||
      new Set(courierIds).size !== courierIds.length
    ) {
      return null;
    }
  }

  return {
    expiredRequestIds: requestIds,
    expiredOfferCourierIdsByRequest: courierIdsByRequest as Readonly<
      Record<string, readonly string[]>
    >,
    expiredCount: value.expiredCount,
    hasMore: value.hasMore,
  };
}

export async function runSweep(): Promise<SweepResult> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  // 1. Solicitudes vencidas: la transacción, guardas, auditoría y ofertas viven en PostgreSQL.
  // El límite evita que un backlog consuma toda la ejecución diaria; la próxima ejecución continúa el resto.
  let expiredRequestsCount = 0;
  const notifiedRequestIds = new Set<string>();

  for (let batch = 0; batch < MAX_RECONCILE_EXPIRED_REQUESTS_CRON_BATCHES; batch += 1) {
    const { data: reconciliationData, error: reconciliationError } = await supabase.rpc(
      'reconcile_expired_requests_cron',
      { p_limit: RECONCILE_EXPIRED_REQUESTS_CRON_LIMIT }
    );
    if (reconciliationError) {
      throw new Error(`Failed to reconcile expired requests: ${reconciliationError.message}`);
    }
    const reconciliation = parseReconcileExpiredRequestsCronResult(reconciliationData);
    if (!reconciliation) {
      throw new Error('Failed to reconcile expired requests: invalid RPC response');
    }

    expiredRequestsCount += reconciliation.expiredCount;
    const newlyExpiredRequestIds = reconciliation.expiredRequestIds.filter(
      (requestId) => !notifiedRequestIds.has(requestId)
    );
    newlyExpiredRequestIds.forEach((requestId) => notifiedRequestIds.add(requestId));

    // T-206: el push es post-commit y best-effort. Solo recibe IDs que la transacción realmente cambió.
    if (newlyExpiredRequestIds.length > 0) {
      try {
        const { data: updatedRequests, error: updatedRequestsError } = await supabase
          .from('delivery_requests')
          .select('id, merchant_id')
          .in('id', newlyExpiredRequestIds);

        if (!updatedRequestsError && updatedRequests) {
          const merchantByRequestId = new Map(
            updatedRequests.map((request) => [request.id, request.merchant_id])
          );
          for (const requestId of newlyExpiredRequestIds) {
            const recipients = new Set<string>();
            const merchantId = merchantByRequestId.get(requestId);
            if (merchantId) recipients.add(merchantId);
            for (const courierId of reconciliation.expiredOfferCourierIdsByRequest[requestId] ?? []) {
              recipients.add(courierId);
            }
            if (recipients.size > 0) {
              await safeNotifyPostTransition(Array.from(recipients), {
                event: 'request_expired',
                requestId,
              });
            }
          }
        }
      } catch {
        // Best effort: fallar al resolver o enviar push nunca revierte la transacción SQL.
      }
    }

    if (!reconciliation.hasMore) break;
    if (reconciliation.expiredCount === 0) {
      console.warn('[cron/sweep] expiraciones pendientes bloqueadas; se reintentará en el próximo cron');
      break;
    }
    if (batch === MAX_RECONCILE_EXPIRED_REQUESTS_CRON_BATCHES - 1) {
      console.warn('[cron/sweep] expiraciones pendientes tras alcanzar el presupuesto de lotes');
    }
  }

  // 2. Purga física de legajos vencidos en courier-docs (courier_documents con purge_after <= now() y purged_at IS NULL)
  const { data: docsToPurge, error: docsFetchError } = await supabase
    .from('courier_documents')
    .select('id, courier_id, storage_path')
    .lte('purge_after', nowIso)
    .is('purged_at', null);

  if (docsFetchError) {
    throw new Error(`Failed to fetch documents to purge: ${docsFetchError.message}`);
  }

  let purgedDocsCount = 0;

  if (docsToPurge && docsToPurge.length > 0) {
    const storagePaths = docsToPurge.map((d) => d.storage_path);

    // Eliminar binarios de Supabase Storage
    const { error: storageError } = await supabase.storage
      .from('courier-docs')
      .remove(storagePaths);

    if (!storageError) {
      const docIds = docsToPurge.map((d) => d.id);

      // D02: audit_log antes de courier_documents.update para que un fallo deje duplicados y no huecos
      const auditEntries = docsToPurge.map((d) => ({
        target_type: 'courier_document',
        target_id: d.id,
        action: 'purged',
        before: { purged_at: null },
        after: { purged_at: nowIso, courier_id: d.courier_id },
      }));

      const { error: auditError } = await supabase.from('audit_log').insert(auditEntries);
      if (auditError) {
        throw new Error(`Failed to insert audit_log for purged documents: ${auditError.message}`);
      }

      // Marcar purged_at = now() solo si el storage remove no dio error
      const { data: updatedDocs, error: docUpdateError } = await supabase
        .from('courier_documents')
        .update({ purged_at: nowIso })
        .in('id', docIds)
        .is('purged_at', null)
        .select('id');

      if (docUpdateError) {
        throw new Error(`Failed to update purged courier_documents: ${docUpdateError.message}`);
      }

      purgedDocsCount = updatedDocs?.length ?? 0;
    } else {
      // H01: terminar en error para que la ruta responda 500 y el cron registre la falla
      throw new Error(`Failed to purge courier documents from storage: ${storageError.message}`);
    }
  }

  // 3. Suscripciones comerciales vencidas (merchants con subscription_status = 'active')
  const { data: graceSetting, error: settingError } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'subscription_grace_days')
    .maybeSingle();

  if (settingError) {
    throw new Error(`Failed to fetch platform_settings: ${settingError.message}`);
  }

  let graceDays = 0;
  if (graceSetting && graceSetting.value != null) {
    const parsedGrace = parseInt(
      typeof graceSetting.value === 'string'
        ? graceSetting.value.replace(/"/g, '')
        : String(graceSetting.value),
      10
    );
    if (!isNaN(parsedGrace) && parsedGrace >= 0) {
      graceDays = parsedGrace;
    }
  }

  const { data: activeMerchants, error: merchantError } = await supabase
    .from('merchants')
    .select('profile_id, paid_until, subscription_status')
    .eq('subscription_status', 'active');

  if (merchantError) {
    throw new Error(`Failed to fetch active merchants: ${merchantError.message}`);
  }

  let expiredSubscriptionsCount = 0;

  if (activeMerchants && activeMerchants.length > 0) {
    const nowDate = new Date(nowIso);
    const expiredMerchants: Array<{ profile_id: string; paid_until: string | null }> = [];

    for (const merchant of activeMerchants) {
      const publishCheck = canMerchantPublishRequest({
        subscriptionStatus: merchant.subscription_status,
        pilotActive: false,
        paidUntil: merchant.paid_until,
        graceDays,
        now: nowDate,
      });

      if (!publishCheck.ok) {
        expiredMerchants.push({
          profile_id: merchant.profile_id,
          paid_until: merchant.paid_until,
        });
      }
    }

    if (expiredMerchants.length > 0) {
      const expiredProfileIds = expiredMerchants.map((m) => m.profile_id);

      // Fecha de corte en Aguilares (-03:00) para guarda TOCTOU contra renovaciones concurrentes
      const nowAguilares = new Date(nowDate.getTime() - 3 * 3600 * 1000);
      const cutoff = new Date(nowAguilares.getTime() - (graceDays + 1) * 86_400_000);
      const cutoffDate = cutoff.toISOString().split('T')[0];

      const { data: updatedMerchants, error: merchantUpdateError } = await supabase
        .from('merchants')
        .update({ subscription_status: 'expired' })
        .in('profile_id', expiredProfileIds)
        .eq('subscription_status', 'active')
        .or(`paid_until.lte.${cutoffDate},paid_until.is.null`)
        .select('profile_id, paid_until');

      if (merchantUpdateError) {
        throw new Error(`Failed to update merchants to expired: ${merchantUpdateError.message}`);
      }

      if (updatedMerchants && updatedMerchants.length > 0) {
        // D02: audit_log solo para los comercios efectivamente actualizados
        const auditEntries = updatedMerchants.map((m) => ({
          target_type: 'merchant',
          target_id: m.profile_id,
          action: 'subscription_expired',
          before: { subscription_status: 'active', paid_until: m.paid_until },
          after: { subscription_status: 'expired' },
        }));

        const { error: auditError } = await supabase.from('audit_log').insert(auditEntries);
        if (auditError) {
          throw new Error(
            `Failed to insert audit_log for expired merchants: ${auditError.message}`
          );
        }

        expiredSubscriptionsCount = updatedMerchants.length;
      }
    }
  }

  // 4. CC-030: objetos de courier-docs sin fila en courier_documents, fuera de la ventana de gracia.
  // Va último para que una falla de Storage no frene los pasos anteriores; igual termina en error (H01).
  const orphanCourierDocuments = await reconcileOrphanCourierDocuments(
    supabase,
    serverEnv.COURIER_DOCS_ORPHAN_PURGE_MODE
  );

  return {
    expiredRequestsCount,
    purgedDocsCount,
    expiredSubscriptionsCount,
    orphanCourierDocuments,
  };
}
