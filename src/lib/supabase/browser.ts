import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env.public';
import type { Database } from '@/types/database.types';

/**
 * Crea un cliente Supabase para Client Components en el navegador.
 */
export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
