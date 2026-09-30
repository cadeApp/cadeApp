'use server';

import { createClient } from '@/server/supabase/server';
import { createAdminClient } from '@/server/supabase/admin';
import { type ActionResult, type DomainErrorCode, err, ok } from '@/domain/errors';
import {
  SIGNUP_ROLES,
  consentStatusSchema,
  profileRoleSchema,
  type ConsentStatus,
  type ProfileRole,
} from '@/domain/schemas';
import { loginSchema, registerSchema, forgotPasswordSchema, type SignupRole } from './schemas';
import { getRoleDefaultPath, resolvePostLoginRedirect } from './guards';
import { areCurrentLegalVersions } from '@/features/legal';

export async function loginAction(
  input: unknown
): Promise<
  ActionResult<
    { userId: string; role: ProfileRole; consentStatus: ConsentStatus; redirectTo: string },
    DomainErrorCode
  >
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
    .select('role, consent_status')
    .eq('id', data.user.id)
    .maybeSingle<{ role: unknown; consent_status: unknown }>();

  if (profileError || !profile) {
    return err('UNAUTHORIZED_ACTOR');
  }

  const roleParsed = profileRoleSchema.safeParse(profile.role);
  if (!roleParsed.success) {
    return err('UNAUTHORIZED_ACTOR');
  }

  const consentParsed = consentStatusSchema.safeParse(profile.consent_status);
  if (!consentParsed.success) {
    return err('UNAUTHORIZED_ACTOR');
  }

  const role = roleParsed.data;
  const consentStatus = consentParsed.data;
  const redirectTo = resolvePostLoginRedirect(parsed.data.redirectTo, role, consentStatus);

  return ok({
    userId: data.user.id,
    role,
    consentStatus,
    redirectTo,
  });
}

/** Códigos con los que Supabase Auth indica que el email ya tiene cuenta. */
const EXISTING_ACCOUNT_CODES: ReadonlySet<string> = new Set([
  'user_already_exists',
  'email_exists',
]);

/**
 * Traduce el `code` de un error genuino de Supabase Auth a un código de dominio que la pantalla puede
 * explicar. Solo los códigos listados se atribuyen a los datos ingresados; cualquier otro (configuración,
 * hooks, captcha, desconocido o ausente) es una falla del servicio. Las señales de cuenta existente no
 * pasan por acá: responden como un alta nueva (ver `registerAction`).
 */
function signUpErrorCode(code: string | undefined): DomainErrorCode {
  switch (code) {
    case 'weak_password':
    case 'email_address_invalid':
    case 'validation_failed':
      return 'VALIDATION_ERROR';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'RATE_LIMITED';
    default:
      return 'INTERNAL_ERROR';
  }
}

/**
 * Resultado público de un alta. No incluye el id del usuario: la respuesta ante un email ya registrado
 * tiene que ser idéntica a la de un alta nueva (anti-enumeración, T-318).
 */
function signUpAccepted(
  role: SignupRole
): ActionResult<{ role: ProfileRole; redirectTo: string }, DomainErrorCode> {
  return ok({
    role,
    redirectTo: role === 'merchant' ? '/merchant/onboarding' : '/courier/onboarding/identity',
  });
}

export async function registerAction(
  input: unknown
): Promise<ActionResult<{ role: ProfileRole; redirectTo: string }, DomainErrorCode>> {
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
    // Email ya registrado: se responde como un alta nueva, sin activar consentimientos.
    if (error.code && EXISTING_ACCOUNT_CODES.has(error.code)) {
      return signUpAccepted(parsed.data.role);
    }
    return err(signUpErrorCode(error.code));
  }

  if (!data.user) {
    return err('INTERNAL_ERROR');
  }

  // Con confirmación de email activa, Supabase responde a un email ya registrado con un usuario sanitizado
  // sin identidades, para no revelar que la cuenta existe. No se activan consentimientos sobre ese id y se
  // responde igual que ante un alta nueva.
  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return signUpAccepted(parsed.data.role);
  }

  const adminClient = createAdminClient();
  const { error: activationError } = await adminClient.rpc('activate_account_consents', {
    p_user_id: data.user.id,
    p_tos_version: parsed.data.acceptedTermsVersion,
    p_privacy_version: parsed.data.acceptedPrivacyVersion,
  });

  if (activationError) {
    // Best-effort cleanup si la activación atómica falla.
    // El invariante de seguridad no depende de esta compensación: la cuenta permanece
    // en consent_status = 'pending' y queda inoperativa por guard, RLS y RPC (CC-007).
    try {
      await adminClient.auth.admin.deleteUser(data.user.id);
    } catch {
      // Best-effort; el usuario no tiene acceso funcional.
    }
    return err('INTERNAL_ERROR');
  }

  return signUpAccepted(parsed.data.role);
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
  try {
    const user =
      typeof supabase.auth.getUser === 'function'
        ? (await supabase.auth.getUser()).data?.user
        : null;

    if (user?.id) {
      const adminClient = createAdminClient();
      await adminClient.from('push_subscriptions').delete().eq('user_id', user.id);
    }
  } catch {
    // Best-effort: fallo en la resolución de usuario o purga no impide el logout del usuario
  }

  await supabase.auth.signOut();
  return ok(null);
}
