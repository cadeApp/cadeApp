import 'server-only';

import { createClient } from '@/server/supabase/server';

export interface ZoneOption {
  readonly id: string;
  readonly name: string;
}

export async function getActiveZones(): Promise<ZoneOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('zones')
    .select('id, name')
    .eq('active', true)
    .order('name', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data;
}
