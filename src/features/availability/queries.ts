import 'server-only';

import { createClient } from '@/server/supabase/server';

export async function getCourierAvailability(): Promise<boolean> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return false;
  }

  const { data: courier, error } = await supabase
    .from('couriers')
    .select('available')
    .eq('profile_id', user.id)
    .maybeSingle<{ available: boolean }>();

  if (error || !courier) {
    return false;
  }

  return courier.available;
}
