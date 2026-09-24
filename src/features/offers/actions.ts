'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/server/supabase/server';
import { submitOfferRpc, withdrawOfferRpc } from '@/server/rpc/offers';
import { type ActionResult, type DomainErrorCode, err, ok } from '@/domain/errors';
import { profileRoleSchema } from '@/domain/schemas';
import type { RpcOutput } from '@/domain/rpc-contracts';
import { submitOfferFormSchema, withdrawOfferFormSchema } from './schemas';

export type SubmitOfferResult = RpcOutput<'submit_offer'>;
export type WithdrawOfferResult = RpcOutput<'withdraw_offer'>;

export async function submitOfferAction(
  input: unknown
): Promise<ActionResult<SubmitOfferResult, DomainErrorCode>> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return err('UNAUTHENTICATED');
  }

  // 1. Verificación de rol del actor
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: unknown }>();

  if (profileError || !profile) {
    return err('UNAUTHORIZED_ACTOR');
  }

  const roleParsed = profileRoleSchema.safeParse(profile.role);
  if (!roleParsed.success || roleParsed.data !== 'courier') {
    return err('UNAUTHORIZED_ACTOR');
  }

  // 2. Validación de entrada con Zod
  const parsed = submitOfferFormSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  // 3. Ejecución de la RPC atómica submit_offer
  const rpcResult = await submitOfferRpc(supabase, parsed.data);
  if (!rpcResult.ok) {
    return err(rpcResult.code);
  }

  revalidatePath('/courier/feed');
  revalidatePath('/courier/offers');
  return ok(rpcResult.data);
}

export async function withdrawOfferAction(
  input: unknown
): Promise<ActionResult<WithdrawOfferResult, DomainErrorCode>> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return err('UNAUTHENTICATED');
  }

  // 1. Verificación de rol del actor
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: unknown }>();

  if (profileError || !profile) {
    return err('UNAUTHORIZED_ACTOR');
  }

  const roleParsed = profileRoleSchema.safeParse(profile.role);
  if (!roleParsed.success || roleParsed.data !== 'courier') {
    return err('UNAUTHORIZED_ACTOR');
  }

  // 2. Validación de entrada con Zod
  const parsed = withdrawOfferFormSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  // 3. Ejecución de la RPC atómica withdraw_offer
  const rpcResult = await withdrawOfferRpc(supabase, parsed.data);
  if (!rpcResult.ok) {
    return err(rpcResult.code);
  }

  revalidatePath('/courier/offers');
  revalidatePath('/courier/feed');
  return ok(rpcResult.data);
}
