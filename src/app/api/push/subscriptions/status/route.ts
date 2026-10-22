import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/server/supabase/server';

export const runtime = 'nodejs';

const statusSchema = z.object({
  endpoint: z.string().url(),
});

/**
 * T-382: ¿el endpoint push de este navegador está registrado a nombre de la cuenta logueada?
 * El endpoint es una URL de capacidad: va solo en el cuerpo y nunca vuelve en la respuesta ni en los errores.
 * Consulta con el cliente de sesión, acotada a `user_id = auth.uid()` sobre la RLS existente.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { data, error: dbError } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', parsed.data.endpoint)
      .eq('user_id', user.id)
      .maybeSingle();

    if (dbError) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ active: data !== null });
  } catch {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
