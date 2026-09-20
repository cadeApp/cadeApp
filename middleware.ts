import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(_request: NextRequest) {
  // Placeholder inicial T-000: en T-009 se integrará la actualización de sesión de Supabase Auth
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|brand|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
