import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/server/supabase/server';
import type { Database } from '@/types/database.types';

type AppSupabaseClient = SupabaseClient<Database, 'public', 'public', Database['public']>;

export interface ZoneOption {
  readonly id: string;
  readonly name: string;
  readonly centroidLat: number | null;
  readonly centroidLng: number | null;
}

export interface MerchantDefaultPickup {
  readonly defaultPickupAddress: string | null;
  readonly defaultPickupZoneId: string | null;
  readonly defaultPickupLat: number | null;
  readonly defaultPickupLng: number | null;
  readonly notes: string | null;
}

interface ZoneRow {
  id: string;
  name: string;
  centroid_lat: number | null;
  centroid_lng: number | null;
}

export async function getActiveZones(): Promise<ZoneOption[]> {
  const supabase = (await createClient()) as unknown as AppSupabaseClient;
  const { data, error } = await supabase
    .from('zones')
    .select<string, ZoneRow>('id, name, centroid_lat, centroid_lng')
    .eq('active', true)
    .order('name', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((z) => ({
    id: z.id,
    name: z.name,
    centroidLat: z.centroid_lat,
    centroidLng: z.centroid_lng,
  }));
}

export async function getMerchantDefaultPickup(
  merchantProfileId: string
): Promise<MerchantDefaultPickup | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('merchants')
    .select(
      'default_pickup_address, default_pickup_zone_id, default_pickup_lat, default_pickup_lng, notes'
    )
    .eq('profile_id', merchantProfileId)
    .maybeSingle<{
      default_pickup_address: string | null;
      default_pickup_zone_id: string | null;
      default_pickup_lat: number | null;
      default_pickup_lng: number | null;
      notes: string | null;
    }>();

  if (error || !data) {
    return null;
  }

  return {
    defaultPickupAddress: data.default_pickup_address,
    defaultPickupZoneId: data.default_pickup_zone_id,
    defaultPickupLat: data.default_pickup_lat,
    defaultPickupLng: data.default_pickup_lng,
    notes: data.notes,
  };
}
