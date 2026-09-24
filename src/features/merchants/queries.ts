import 'server-only';

import { createClient } from '@/server/supabase/server';

export interface ZoneOption {
  readonly id: string;
  readonly name: string;
}

export interface MerchantAccountProfile {
  readonly businessName: string;
  readonly defaultPickupAddress: string | null;
  readonly zoneName: string | null;
  readonly phone: string | null;
  readonly notes: string | null;
  readonly subscriptionStatus: 'trial' | 'active' | 'grace_period' | 'suspended';
  readonly paidUntil: string | null;
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

export async function getMerchantAccountProfile(): Promise<MerchantAccountProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  interface MerchantQueryRow {
    readonly business_name: string;
    readonly default_pickup_address: string | null;
    readonly default_pickup_zone_id: string | null;
    readonly notes: string | null;
    readonly subscription_status: 'trial' | 'active' | 'grace_period' | 'suspended';
    readonly paid_until: string | null;
    readonly zones: { readonly name?: string } | null;
  }

  interface ProfileQueryRow {
    readonly display_name: string | null;
    readonly phone: string | null;
  }

  const [{ data: merchant, error: merchantError }, { data: profile }] = await Promise.all([
    supabase
      .from('merchants')
      .select(
        'business_name, default_pickup_address, default_pickup_zone_id, notes, subscription_status, paid_until, zones:default_pickup_zone_id(name)'
      )
      .eq('profile_id', user.id)
      .maybeSingle<MerchantQueryRow>(),
    supabase
      .from('profiles')
      .select('display_name, phone')
      .eq('id', user.id)
      .maybeSingle<ProfileQueryRow>(),
  ]);

  if (merchantError || !merchant) {
    return null;
  }

  return {
    businessName: merchant.business_name,
    defaultPickupAddress: merchant.default_pickup_address,
    zoneName: merchant.zones?.name ?? null,
    phone: profile?.phone ?? null,
    notes: merchant.notes ?? null,
    subscriptionStatus: merchant.subscription_status,
    paidUntil: merchant.paid_until,
  };
}
