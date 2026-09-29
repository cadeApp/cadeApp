'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/server/supabase/server';
import { setAvailabilityRpc } from '@/server/rpc/offers';
import { type ActionResult, type DomainErrorCode, err, ok } from '@/domain/errors';
import { profileRoleSchema } from '@/domain/schemas';
import { setAvailabilitySchema } from './schemas';

export interface SetAvailabilityResult {
  readonly courierId: string;
  readonly available: boolean;
}

export async function setAvailabilityAction(
  input: unknown
): Promise<ActionResult<SetAvailabilityResult, DomainErrorCode>> {
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

  // 2. Validación de datos de entrada
  const parsed = setAvailabilitySchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  // 3. Ejecución de la RPC atómica set_availability
  const rpcResult = await setAvailabilityRpc(supabase, parsed.data);
  if (!rpcResult.ok) {
    return err(rpcResult.code);
  }

  revalidatePath('/courier/feed');
  return ok(rpcResult.data);
}
