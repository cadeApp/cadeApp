import 'server-only';
import { createAdminClient } from '@/server/supabase/admin';

export interface SweepResult {
  expiredRequestsCount: number;
  purgedDocsCount: number;
  expiredSubscriptionsCount: number;
}

export async function runSweep(): Promise<SweepResult> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();
  const currentDateIso = nowIso.split('T')[0] ?? '';

  // 1. Solicitudes vencidas (delivery_requests con status = 'published' y expires_at <= now())
  const { data: expiredRequests, error: reqFetchError } = await supabase
    .from('delivery_requests')
    .select('id, merchant_id')
    .eq('status', 'published')
    .lte('expires_at', nowIso);

  let expiredRequestsCount = 0;

  if (!reqFetchError && expiredRequests && expiredRequests.length > 0) {
    const expiredRequestIds = expiredRequests.map((r) => r.id);

    // Actualizar solicitudes a 'expired'
    await supabase
      .from('delivery_requests')
      .update({ status: 'expired' })
      .in('id', expiredRequestIds);

    // Actualizar ofertas 'pending' asociadas a 'expired' con decided_at = now()
    await supabase
      .from('offers')
      .update({ status: 'expired', decided_at: nowIso })
      .in('request_id', expiredRequestIds)
      .eq('status', 'pending');

    // Registrar en audit_log
    const auditEntries = expiredRequests.map((r) => ({
      target_type: 'delivery_requests',
      target_id: r.id,
      action: 'expired',
      after: { status: 'expired', expired_at: nowIso },
    }));

    await supabase.from('audit_log').insert(auditEntries);
    expiredRequestsCount = expiredRequests.length;
  }

  // 2. Purga física de legajos vencidos en courier-docs (courier_documents con purge_after <= now() y purged_at IS NULL)
  const { data: docsToPurge, error: docsFetchError } = await supabase
    .from('courier_documents')
    .select('id, courier_id, storage_path')
    .lte('purge_after', nowIso)
    .is('purged_at', null);

  let purgedDocsCount = 0;

  if (!docsFetchError && docsToPurge && docsToPurge.length > 0) {
    const storagePaths = docsToPurge.map((d) => d.storage_path);
    const docIds = docsToPurge.map((d) => d.id);

    // Eliminar binarios de Supabase Storage
    await supabase.storage.from('courier-docs').remove(storagePaths);

    // Marcar purged_at = now()
    await supabase
      .from('courier_documents')
      .update({ purged_at: nowIso })
      .in('id', docIds);

    // Registrar en audit_log
    const auditEntries = docsToPurge.map((d) => ({
      target_type: 'courier_document',
      target_id: d.id,
      action: 'purged',
      after: { purged_at: nowIso, courier_id: d.courier_id },
    }));

    await supabase.from('audit_log').insert(auditEntries);
    purgedDocsCount = docsToPurge.length;
  }

  // 3. Suscripciones comerciales vencidas (merchants con subscription_status = 'active' y paid_until + grace_days < currentDate)
  const { data: graceSetting } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'subscription_grace_days')
    .maybeSingle();

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
    .select('profile_id, paid_until')
    .eq('subscription_status', 'active');

  let expiredSubscriptionsCount = 0;

  if (!merchantError && activeMerchants && activeMerchants.length > 0) {
    const expiredMerchantIds: string[] = [];

    for (const merchant of activeMerchants) {
      if (!merchant.paid_until) {
        expiredMerchantIds.push(merchant.profile_id);
        continue;
      }

      const paidUntilDate = new Date(merchant.paid_until);
      paidUntilDate.setDate(paidUntilDate.getDate() + graceDays);
      const paidUntilWithGraceStr = paidUntilDate.toISOString().split('T')[0] ?? '';
      if (paidUntilWithGraceStr < currentDateIso) {
        expiredMerchantIds.push(merchant.profile_id);
      }
    }

    if (expiredMerchantIds.length > 0) {
      await supabase
        .from('merchants')
        .update({ subscription_status: 'expired' })
        .in('profile_id', expiredMerchantIds);

      const auditEntries = expiredMerchantIds.map((id) => ({
        target_type: 'merchants',
        target_id: id,
        action: 'subscription_expired',
        after: { subscription_status: 'expired' },
      }));

      await supabase.from('audit_log').insert(auditEntries);
      expiredSubscriptionsCount = expiredMerchantIds.length;
    }
  }

  return {
    expiredRequestsCount,
    purgedDocsCount,
    expiredSubscriptionsCount,
  };
}
