import { type NextRequest, NextResponse } from 'next/server';
import { type EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/server/supabase/server';
import { consentStatusSchema, profileRoleSchema } from '@/domain/schemas';
import { resolvePostLoginRedirect, getRoleDefaultPath } from '@/features/auth';

const ALLOWED_NEXT_PATHS = new Set<string>(['/reset-password']);
const ALLOWED_OTP_TYPES = new Set<string>(['signup', 'email', 'recovery']);

function sanitizeNextParam(next: string | null): string | null {
  if (!next) return null;
  // Prevenir ataques con //evil, /\evil, URLs absolutas o caracteres de control
  if (
    next.startsWith('//') ||
    next.includes('://') ||
    next.includes('\\') ||
    /[\r\n]/.test(next)
  ) {
    return null;
  }
  const cleanPath = next.split('?')[0]?.split('#')[0];
  if (cleanPath && ALLOWED_NEXT_PATHS.has(cleanPath)) {
    return cleanPath;
  }
  return null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const nextParam = searchParams.get('next');

  const errorUrl = new URL('/login?authError=link_invalid', origin);

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(errorUrl, 303);
    }
  } else if (token_hash && type) {
    if (!ALLOWED_OTP_TYPES.has(type)) {
      return NextResponse.redirect(errorUrl, 303);
    }
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    });
    if (error) {
      return NextResponse.redirect(errorUrl, 303);
    }
  } else {
    return NextResponse.redirect(errorUrl, 303);
  }

  // Si fue un enlace de recuperación o next es /reset-password
  const validNext = sanitizeNextParam(nextParam);
  if (type === 'recovery' || validNext === '/reset-password') {
    return NextResponse.redirect(new URL('/reset-password', origin), 303);
  }

  // Enlace de registro / email: resolver destino por rol y consent_status
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return NextResponse.redirect(errorUrl, 303);
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, consent_status')
    .eq('id', userData.user.id)
    .maybeSingle<{ role: unknown; consent_status: unknown }>();

  if (profileError || !profile) {
    return NextResponse.redirect(errorUrl, 303);
  }

  const roleParsed = profileRoleSchema.safeParse(profile.role);
  const consentParsed = consentStatusSchema.safeParse(profile.consent_status);

  if (!roleParsed.success) {
    return NextResponse.redirect(errorUrl, 303);
  }

  let destination = '/';
  if (consentParsed.success) {
    destination = resolvePostLoginRedirect(null, roleParsed.data, consentParsed.data);
  } else {
    destination = getRoleDefaultPath(roleParsed.data);
  }

  return NextResponse.redirect(new URL(destination, origin), 303);
}
