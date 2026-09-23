'use server';

import { createClient } from '@/server/supabase/server';
import { type ActionResult, type DomainErrorCode, err, ok } from '@/domain/errors';
import { profileRoleSchema } from '@/domain/schemas';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { merchantOnboardingSchema } from './schemas';

export interface MerchantOnboardingResult {
  readonly redirectTo: string;
}

export async function merchantOnboardingAction(
  input: unknown
): Promise<ActionResult<MerchantOnboardingResult, DomainErrorCode>> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return err('UNAUTHENTICATED');
  }

  // 1. Verificación de rol del actor
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: unknown }>();

  if (profileError || !profile) {
    return err('UNAUTHORIZED_ACTOR');
  }

  const roleParsed = profileRoleSchema.safeParse(profile.role);
  if (!roleParsed.success || roleParsed.data !== 'merchant') {
    return err('UNAUTHORIZED_ACTOR');
  }

  // 2. Validación de datos de entrada
  const parsed = merchantOnboardingSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  // 3. Consulta de la versión configurada de los términos del piloto
  const { data: settingData, error: settingError } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'pilot_terms_version')
    .maybeSingle<{ value: unknown }>();

  if (
    settingError ||
    !settingData ||
    settingData.value === null ||
    settingData.value === undefined
  ) {
    return err('INTERNAL_ERROR');
  }

  const rawValue = settingData.value;
  let pilotTermsVersion: string;
  if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
    pilotTermsVersion = rawValue.trim();
  } else if (typeof rawValue === 'number') {
    pilotTermsVersion = String(rawValue);
  } else {
    return err('INTERNAL_ERROR');
  }

  // 4. Registro de consentimiento de términos del piloto
  const consentPayload: TablesInsert<'consents'> = {
    profile_id: user.id,
    document: 'pilot_terms',
    version: pilotTermsVersion,
  };

  const { error: consentError } = await supabase.from('consents').insert(consentPayload as never);

  if (consentError) {
    return err('INTERNAL_ERROR');
  }

  // 5. Actualización del perfil (nombre y teléfono)
  const profilePayload: TablesUpdate<'profiles'> = {
    display_name: parsed.data.businessName,
    phone: parsed.data.phone,
  };

  const { error: profileUpdateError } = await supabase
    .from('profiles')
    .update(profilePayload as never)
    .eq('id', user.id);

  if (profileUpdateError) {
    return err('INTERNAL_ERROR');
  }

  // 6. Registro / Upsert del comercio en estado 'pilot'
  const merchantPayload: TablesInsert<'merchants'> = {
    profile_id: user.id,
    business_name: parsed.data.businessName,
    default_pickup_address: parsed.data.defaultPickupAddress,
    default_pickup_lat: parsed.data.defaultPickupLat ?? null,
    default_pickup_lng: parsed.data.defaultPickupLng ?? null,
    default_pickup_zone_id: parsed.data.defaultPickupZoneId ?? null,
    notes: parsed.data.notes ?? null,
    subscription_status: 'pilot',
    paid_until: null,
  };

  const { error: merchantError } = await supabase
    .from('merchants')
    .upsert(merchantPayload as never);

  if (merchantError) {
    return err('INTERNAL_ERROR');
  }

  return ok({
    redirectTo: '/merchant/dashboard',
  });
}
