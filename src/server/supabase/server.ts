import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicEnv } from '@/lib/env.public';
import type { Database } from '@/types/database.types';

/**
 * Crea un cliente Supabase para Server Components, Server Actions y Route Handlers.
 * Maneja lectura y escritura de cookies delegando en cookies() de Next.js.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignorado en Server Components de solo lectura (cubierto por middleware).
          }
        },
      },
    }
  );
}
