'use server';

import { revalidatePath } from 'next/cache';
import { type ActionResult, type DomainErrorCode, err, ok } from '@/domain/errors';
import { profileRoleSchema } from '@/domain/schemas';
import type { RpcOutput } from '@/domain/rpc-contracts';
import { callRequestRpc } from '@/server/rpc/requests';
import { createClient } from '@/server/supabase/server';
import { createDeliveryRequestSchema, cancelMerchantRequestSchema } from './schemas';

export interface CreateDeliveryRequestResult {
  readonly requestId: string;
  readonly redirectTo: string;
}

export async function createDeliveryRequestAction(
  input: unknown
): Promise<ActionResult<CreateDeliveryRequestResult, DomainErrorCode>> {
  const supabase = await createClient();

  // 1. Verificación de sesión de autenticación
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return err('UNAUTHENTICATED');
  }

  // 2. Verificación de rol del actor (merchant obligatorio)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: unknown }>();

  if (profileError || !profile) {
    return err('UNAUTHORIZED_ACTOR');
  }

  const roleParsed = profileRoleSchema.safeParse(profile.role);
  if (!roleParsed.success || roleParsed.data !== 'merchant') {
    return err('UNAUTHORIZED_ACTOR');
  }

  // 3. Validación de datos de entrada con Zod
  const parsed = createDeliveryRequestSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  const data = parsed.data;

  // 4. Alta y publicación atómica mediante RPC (CC-024 / Gate 4)
  // PR330-H09: el UUID proviene exclusivamente de la UI; la Server Action nunca genera ID por invocación.
  if (!data.requestId) {
    return err('VALIDATION_ERROR');
  }

  const rpcResult = await callRequestRpc(supabase, 'create_and_publish_multi_drop', {
    requestId: data.requestId,
    pickupZoneId: data.pickupZoneId,
    pickupAddress: data.pickupAddress,
    pickupLat: data.pickupLat ?? null,
    pickupLng: data.pickupLng ?? null,
    fixedPriceArs: data.fixedPriceArs ?? null,
    autoAssign: data.autoAssign,
    drops: data.drops.map((drop) => ({
      dropoffZoneId: drop.dropoffZoneId,
      dropoffAddress: drop.dropoffAddress,
      dropoffLat: drop.dropoffLat ?? null,
      dropoffLng: drop.dropoffLng ?? null,
      recipientName: drop.recipientName,
      recipientPhone: drop.recipientPhone,
      recipientConsentDeclared: drop.recipientConsentDeclared,
      packageType: drop.packageType,
      recipientPaymentMethod: drop.recipientPaymentMethod,
      needsChange: drop.needsChange,
      cashChangeAmount:
        drop.recipientPaymentMethod === 'cash' && drop.needsChange
          ? (drop.cashChangeAmount ?? null)
          : null,
      notes: drop.notes ?? null,
    })),
  });

  if (!rpcResult.ok) {
    return err(rpcResult.code);
  }

  return ok({
    requestId: rpcResult.data.requestId,
    redirectTo: '/merchant/dashboard',
  });
}

export type CancelMerchantRequestResult = RpcOutput<'cancel_request'>;

/**
 * Comercio cancela solicitud en estado cancelable (published o matched).
 * Valida sesión y rol merchant, ejecuta RPC cancel_request y revalida vistas.
 */
export async function cancelMerchantRequestAction(
  input: unknown
): Promise<ActionResult<CancelMerchantRequestResult, DomainErrorCode>> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return err('UNAUTHENTICATED');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: unknown }>();

  if (profileError || !profile) {
    return err('UNAUTHORIZED_ACTOR');
  }

  const roleParsed = profileRoleSchema.safeParse(profile.role);
  if (!roleParsed.success || roleParsed.data !== 'merchant') {
    return err('UNAUTHORIZED_ACTOR');
  }

  const parsed = cancelMerchantRequestSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  const rpcResult = await callRequestRpc(supabase, 'cancel_request', parsed.data);
  if (!rpcResult.ok) {
    return err(rpcResult.code);
  }

  revalidatePath(`/trips/${parsed.data.requestId}`);
  revalidatePath('/merchant/requests');
  revalidatePath('/merchant/dashboard');
  return ok(rpcResult.data);
}
