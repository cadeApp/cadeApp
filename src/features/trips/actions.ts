'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/server/supabase/server';
import { callRequestRpc } from '@/server/rpc/requests';
import { type ActionResult, type DomainErrorCode, ok, err } from '@/domain/errors';
import { profileRoleSchema } from '@/domain/schemas';
import type { RpcOutput } from '@/domain/rpc-contracts';
import {
  tripActionBaseSchema,
  courierCancelTripSchema,
  merchantReportNoShowSchema,
  merchantCancelTripSchema,
  republishTripSchema,
} from './schemas';

export type MarkPickedUpResult = RpcOutput<'mark_picked_up'>;
export type MarkDeliveredResult = RpcOutput<'mark_delivered'>;
export type CourierCancelMatchResult = RpcOutput<'courier_cancel_match'>;
export type ReportNoShowResult = RpcOutput<'report_no_show'>;
export type CancelRequestResult = RpcOutput<'cancel_request'>;
export type RepublishRequestResult = RpcOutput<'republish_request'>;

/**
 * Validador helper para asegurar sesión y rol del actor antes de llamar RPC.
 */
async function authenticateRole(requiredRole: 'merchant' | 'courier') {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: err('UNAUTHENTICATED' as DomainErrorCode), supabase: null, user: null };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: unknown }>();

  if (profileError || !profile) {
    return { error: err('UNAUTHORIZED_ACTOR' as DomainErrorCode), supabase: null, user: null };
  }

  const roleParsed = profileRoleSchema.safeParse(profile.role);
  if (!roleParsed.success || roleParsed.data !== requiredRole) {
    return { error: err('UNAUTHORIZED_ACTOR' as DomainErrorCode), supabase: null, user: null };
  }

  return { error: null, supabase, user };
}

/**
 * Repartidor marca pedido como retirado: matched -> in_transit (C06 / R07).
 */
export async function markTripPickedUpAction(
  input: unknown
): Promise<ActionResult<MarkPickedUpResult, DomainErrorCode>> {
  const auth = await authenticateRole('courier');
  if (auth.error || !auth.supabase) return auth.error;

  const parsed = tripActionBaseSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION_ERROR');

  const rpcResult = await callRequestRpc(auth.supabase, 'mark_picked_up', parsed.data);
  if (!rpcResult.ok) return err(rpcResult.code);

  revalidatePath(`/courier/trips/${parsed.data.requestId}`);
  revalidatePath('/courier/feed');
  return ok(rpcResult.data);
}

/**
 * Repartidor marca pedido como entregado: in_transit -> delivered (R07).
 */
export async function markTripDeliveredAction(
  input: unknown
): Promise<ActionResult<MarkDeliveredResult, DomainErrorCode>> {
  const auth = await authenticateRole('courier');
  if (auth.error || !auth.supabase) return auth.error;

  const parsed = tripActionBaseSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION_ERROR');

  const rpcResult = await callRequestRpc(auth.supabase, 'mark_delivered', parsed.data);
  if (!rpcResult.ok) return err(rpcResult.code);

  revalidatePath(`/courier/trips/${parsed.data.requestId}`);
  revalidatePath('/courier/feed');
  return ok(rpcResult.data);
}

/**
 * Repartidor cancela match con motivo obligatorio: matched -> published (R07 / T05).
 */
export async function courierCancelTripAction(
  input: unknown
): Promise<ActionResult<CourierCancelMatchResult, DomainErrorCode>> {
  const auth = await authenticateRole('courier');
  if (auth.error || !auth.supabase) return auth.error;

  const parsed = courierCancelTripSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION_ERROR');

  const rpcResult = await callRequestRpc(auth.supabase, 'courier_cancel_match', parsed.data);
  if (!rpcResult.ok) return err(rpcResult.code);

  revalidatePath(`/courier/trips/${parsed.data.requestId}`);
  revalidatePath('/courier/feed');
  return ok(rpcResult.data);
}

/**
 * Comercio reporta que el repartidor no llegó: devuelve solicitud a published (C06).
 * Si republish se omite, aplica republish: true por defecto (H03).
 */
export async function merchantReportNoShowAction(
  input: unknown
): Promise<ActionResult<ReportNoShowResult, DomainErrorCode>> {
  const auth = await authenticateRole('merchant');
  if (auth.error || !auth.supabase) return auth.error;

  const parsed = merchantReportNoShowSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION_ERROR');

  const rpcResult = await callRequestRpc(auth.supabase, 'report_no_show', parsed.data);
  if (!rpcResult.ok) return err(rpcResult.code);

  revalidatePath(`/merchant/trips/${parsed.data.requestId}`);
  revalidatePath('/merchant/requests');
  return ok(rpcResult.data);
}

/**
 * Comercio cancela viaje con motivo obligatorio (C06 / T05).
 */
export async function merchantCancelTripAction(
  input: unknown
): Promise<ActionResult<CancelRequestResult, DomainErrorCode>> {
  const auth = await authenticateRole('merchant');
  if (auth.error || !auth.supabase) return auth.error;

  const parsed = merchantCancelTripSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION_ERROR');

  const rpcResult = await callRequestRpc(auth.supabase, 'cancel_request', parsed.data);
  if (!rpcResult.ok) return err(rpcResult.code);

  revalidatePath(`/merchant/trips/${parsed.data.requestId}`);
  revalidatePath('/merchant/requests');
  return ok(rpcResult.data);
}

/**
 * Comercio republica solicitud para recibir nuevas ofertas (C06).
 */
export async function republishTripAction(
  input: unknown
): Promise<ActionResult<RepublishRequestResult, DomainErrorCode>> {
  const auth = await authenticateRole('merchant');
  if (auth.error || !auth.supabase) return auth.error;

  const parsed = republishTripSchema.safeParse(input);
  if (!parsed.success) return err('VALIDATION_ERROR');

  const rpcResult = await callRequestRpc(auth.supabase, 'republish_request', parsed.data);
  if (!rpcResult.ok) return err(rpcResult.code);

  revalidatePath(`/merchant/trips/${parsed.data.requestId}`);
  revalidatePath('/merchant/requests');
  return ok(rpcResult.data);
}
