'use server';

import { createClient } from '@/server/supabase/server';
import { type ActionResult, type DomainErrorCode, err, ok } from '@/domain/errors';
import { SIGNUP_ROLES, type ProfileRole } from '@/domain/schemas';
import { loginSchema, registerSchema } from './schemas';
import { getRoleDefaultPath } from './guards';

export async function loginAction(
  input: unknown
): Promise<
  ActionResult<{ userId: string; role: ProfileRole; redirectTo: string }, DomainErrorCode>
> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return err('UNAUTHENTICATED');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle<{ role: ProfileRole }>();

  const role = profile?.role ?? 'merchant';
  const redirectTo = getRoleDefaultPath(role);

  return ok({
    userId: data.user.id,
    role,
    redirectTo,
  });
}

export async function registerAction(
  input: unknown
): Promise<
  ActionResult<{ userId: string; role: ProfileRole; redirectTo: string }, DomainErrorCode>
> {
  // Rechazo explícito de intento de registro como admin u otro rol ajeno a merchant/courier
  if (typeof input === 'object' && input !== null && 'role' in input) {
    const rawRole = (input as { role: unknown }).role;
    if (
      rawRole === 'admin' ||
      (typeof rawRole === 'string' && !(SIGNUP_ROLES as readonly string[]).includes(rawRole))
    ) {
      return err('INVALID_SIGNUP_ROLE');
    }
  }

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        role: parsed.data.role,
        ...(parsed.data.displayName ? { display_name: parsed.data.displayName } : {}),
        ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),
      },
    },
  });

  if (error) {
    if (error.message?.includes('INVALID_SIGNUP_ROLE')) {
      return err('INVALID_SIGNUP_ROLE');
    }
    return err('VALIDATION_ERROR');
  }

  if (!data.user) {
    return err('INTERNAL_ERROR');
  }

  return ok({
    userId: data.user.id,
    role: parsed.data.role,
    redirectTo: getRoleDefaultPath(parsed.data.role),
  });
}

export async function logoutAction(): Promise<ActionResult<null, DomainErrorCode>> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return ok(null);
}
