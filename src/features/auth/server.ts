import 'server-only';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicEnv } from '@/lib/env.public';
import type { Database } from '@/types/database.types';
import { profileRoleSchema } from '@/domain/schemas';
import { evaluateRouteGuard, type AuthSession } from './guards';

export * from './queries';
export * from './guards';
export { logoutAction } from './actions';

/**
 * Función de middleware de sesión para actualizar el token de Supabase Auth
 * y evaluar las guardas de rutas según el rol y nivel AAL del usuario.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresca la sesión si está presente
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let session: AuthSession | null = null;
  if (user) {
    // Lecturas paralelas independientes de perfil y MFA AAL (Regla 25 §6)
    const [profileResult, aalResult] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', user.id).maybeSingle<{ role: unknown }>(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);

    if (!profileResult.error && profileResult.data) {
      const roleParsed = profileRoleSchema.safeParse(profileResult.data.role);
      if (roleParsed.success) {
        const aal = aalResult.data?.currentLevel === 'aal2' ? 'aal2' : 'aal1';
        session = {
          userId: user.id,
          email: user.email ?? '',
          role: roleParsed.data,
          aal,
        };
      }
    }
  }

  const guardResult = evaluateRouteGuard(request.nextUrl.pathname, session);

  if (guardResult.action === 'redirect') {
    const redirectUrl = request.nextUrl.clone();
    const [targetPath = '/', queryString] = guardResult.redirectTo.split('?');
    redirectUrl.pathname = targetPath;
    redirectUrl.search = queryString ? `?${queryString}` : '';

    // PR60-H03: Preservar las cookies rotadas de supabaseResponse en la respuesta de redirección
    const redirectResponse = NextResponse.redirect(redirectUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  return supabaseResponse;
}
