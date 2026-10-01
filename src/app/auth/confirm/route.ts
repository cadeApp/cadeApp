import { type NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest): Promise<NextResponse> {
  // Stub inicial para demostrar pruebas RED en T-320
  return NextResponse.json({ error: 'not_implemented' }, { status: 501 });
}
