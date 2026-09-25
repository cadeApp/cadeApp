'use server';

import { createClient } from '@/server/supabase/server';
import { createAdminClient } from '@/server/supabase/admin';
import { type ActionResult, type DomainErrorCode, err, ok } from '@/domain/errors';
import { SIGNUP_ROLES, profileRoleSchema, type ProfileRole } from '@/domain/schemas';
import { loginSchema, registerSchema, forgotPasswordSchema } from './schemas';
import { getRoleDefaultPath, resolvePostLoginRedirect } from './guards';
import { areCurrentLegalVersions } from '@/features/legal';
import type { TablesInsert } from '@/types/database.types';

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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle<{ role: unknown }>();

  if (profileError || !profile) {
    return err('UNAUTHORIZED_ACTOR');
  }

  const roleParsed = profileRoleSchema.safeParse(profile.role);
  if (!roleParsed.success) {
    return err('UNAUTHORIZED_ACTOR');
  }

  const role = roleParsed.data;
  const redirectTo = resolvePostLoginRedirect(parsed.data.redirectTo, role);

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

  if (
    !areCurrentLegalVersions([
      { document: 'tos', version: parsed.data.acceptedTermsVersion },
      { document: 'privacy', version: parsed.data.acceptedPrivacyVersion },
    ])
  ) {
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

  const consentPayload: TablesInsert<'consents'>[] = [
    {
      profile_id: data.user.id,
      document: 'tos',
      version: parsed.data.acceptedTermsVersion,
    },
    {
      profile_id: data.user.id,
      document: 'privacy',
      version: parsed.data.acceptedPrivacyVersion,
    },
  ];

  const adminClient = createAdminClient();
  const { error: consentError } = await adminClient.from('consents').insert(consentPayload as never);
  if (consentError) {
    let deleted = false;
    try {
      const deleteResult = await adminClient.auth.admin.deleteUser(data.user.id);
      deleted = !deleteResult?.error;
    } catch {
      deleted = false;
    }

    if (!deleted) {
      // H06: Si la eliminación completa en Auth falla o devuelve error, neutralizar
      // la cuenta inmediatamente para que no quede utilizable sin consentimientos:
      // eliminar el registro en profiles (lo que en cascada anula roles/permisos)
      // y aplicar ban_duration en Auth para bloquear cualquier autenticación.
      await Promise.allSettled([
        adminClient.from('profiles').delete().eq('id', data.user.id),
        adminClient.auth.admin.updateUserById(data.user.id, {
          ban_duration: '876000h',
        }),
      ]);
    }
    return err('INTERNAL_ERROR');
  }

  const redirectTo =
    parsed.data.role === 'merchant' ? '/merchant/onboarding' : '/courier/onboarding/identity';

  return ok({
    userId: data.user.id,
    role: parsed.data.role,
    redirectTo,
  });
}

export async function requestPasswordResetAction(
  input: unknown
): Promise<ActionResult<{ sent: true }, DomainErrorCode>> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email);

  return ok({ sent: true });
}

export async function logoutAction(): Promise<ActionResult<null, DomainErrorCode>> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return ok(null);
}
