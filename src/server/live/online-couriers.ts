import 'server-only';

import { RPC_CONTRACTS } from '@/domain';
import type { LiveOnlineCouriersResponse } from '@/lib/live-contracts';
import { createClient } from '@/server/supabase/server';
import type { LiveServerResult } from './t204';

/**
 * CC-041 (T-415): repartidores conectados ahora, para el comercio autenticado (`get_online_couriers_count`). La RPC
 * valida el actor y aplica la ventana del parámetro; acá solo se valida la respuesta contra el contrato.
 */
export async function getOnlineCouriersLiveServer(): Promise<LiveServerResult<LiveOnlineCouriersResponse>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_online_couriers_count');
    if (error) {
      const code = error.message.trim();
      if (code === 'UNAUTHENTICATED') return { ok: false, error: code, status: 401 };
      if (code === 'UNAUTHORIZED_ACTOR') return { ok: false, error: code, status: 403 };
      return { ok: false, error: 'DATABASE_ERROR', status: 500 };
    }
    const parsed = RPC_CONTRACTS.get_online_couriers_count.outputSchema.safeParse(data);
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: 'DATABASE_ERROR', status: 500 };
  } catch {
    return { ok: false, error: 'DATABASE_ERROR', status: 500 };
  }
}
