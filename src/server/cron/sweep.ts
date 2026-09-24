import 'server-only';
import { createAdminClient } from '@/server/supabase/admin';
import { canMerchantPublishRequest } from '@/domain/states';

export interface SweepResult {
  expiredRequestsCount: number;
  purgedDocsCount: number;
  expiredSubscriptionsCount: number;
}

export async function runSweep(): Promise<SweepResult> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  // 1. Solicitudes vencidas (delivery_requests con status = 'published' y expires_at <= now())
  const { data: expiredRequests, error: reqFetchError } = await supabase
    .from('delivery_requests')
    .select('id, merchant_id')
    .eq('status', 'published')
    .lte('expires_at', nowIso);

  if (reqFetchError) {
    throw new Error(`Failed to fetch expired requests: ${reqFetchError.message}`);
  }

  let expiredRequestsCount = 0;

  if (expiredRequests && expiredRequests.length > 0) {
    const expiredRequestIds = expiredRequests.map((r) => r.id);

    // Actualizar solicitudes a 'expired' (con guarda TOCTOU status = 'published' y expires_at <= nowIso)
    // D02: delivery_requests.update primero para obtener las filas efectivamente actualizadas
    const { data: updatedRequests, error: reqUpdateError } = await supabase
      .from('delivery_requests')
      .update({ status: 'expired' })
      .in('id', expiredRequestIds)
      .eq('status', 'published')
      .lte('expires_at', nowIso)
      .select('id, merchant_id');

    if (reqUpdateError) {
      throw new Error(`Failed to update delivery_requests to expired: ${reqUpdateError.message}`);
    }

    if (updatedRequests && updatedRequests.length > 0) {
      const actuallyExpiredIds = updatedRequests.map((r) => r.id);

      // D02: audit_log antes de offers.update para que un fallo no deje huecos de auditoría
      const auditEntries = updatedRequests.map((r) => ({
        target_type: 'delivery_request',
        target_id: r.id,
        action: 'expired',
        before: { status: 'published' },
        after: { status: 'expired', expired_at: nowIso },
      }));

      const { error: auditError } = await supabase.from('audit_log').insert(auditEntries);
      if (auditError) {
        throw new Error(`Failed to insert audit_log for expired requests: ${auditError.message}`);
      }

      // Actualizar ofertas 'pending' asociadas a 'expired' con decided_at = now()
      const { error: offersUpdateError } = await supabase
        .from('offers')
        .update({ status: 'expired', decided_at: nowIso })
        .in('request_id', actuallyExpiredIds)
        .eq('status', 'pending');

      if (offersUpdateError) {
        throw new Error(`Failed to update offers to expired: ${offersUpdateError.message}`);
      }

      expiredRequestsCount = updatedRequests.length;
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

  return {
    expiredRequestsCount,
    purgedDocsCount,
    expiredSubscriptionsCount,
  };
}
