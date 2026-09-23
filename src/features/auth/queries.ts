import 'server-only';

import { createClient } from '@/server/supabase/server';
import type { ProfileRole } from '@/domain/schemas';
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

  // Lectura del perfil para obtener el rol asignado
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: ProfileRole }>();

  // Nivel de aseguramiento de autenticación (AAL para MFA)
  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const aal = aalData?.currentLevel === 'aal2' ? 'aal2' : 'aal1';

  return {
    userId: user.id,
    email: user.email ?? '',
    role: profile?.role ?? 'merchant',
    aal,
  };
}
