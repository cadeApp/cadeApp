import 'server-only';

import { createClient } from '@/server/supabase/server';
import { profileRoleSchema } from '@/domain/schemas';
import type { AuthSession } from './guards';

/**
 * Obtiene la sesión autenticada del servidor.
 * Consume asíncronamente createClient() según H16 (Next 15 await cookies()).
 */
export async function getServerSession(): Promise<AuthSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  // Lecturas paralelas independientes de perfil y MFA AAL (Regla 25 §6)
  const [profileResult, aalResult] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle<{ role: unknown }>(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);

  if (profileResult.error || !profileResult.data) {
    return null;
  }

  const roleParsed = profileRoleSchema.safeParse(profileResult.data.role);
  if (!roleParsed.success) {
    return null;
  }

  const aal = aalResult.data?.currentLevel === 'aal2' ? 'aal2' : 'aal1';

  return {
    userId: user.id,
    email: user.email ?? '',
    role: roleParsed.data,
    aal,
  };
}
