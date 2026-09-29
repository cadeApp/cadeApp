import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env.public';
import { serverEnv } from '@/server/env';
import type { Database } from '@/types/database.types';

/**
 * Crea un cliente Supabase con service_role key para operaciones administrativas exclusivas del servidor.
 * Protegido por server-only: nunca se empaqueta en el bundle de cliente.
 */
export function createAdminClient() {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
