'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { type ActionResult, type DomainErrorCode, err, ok } from '@/domain/errors';
import { calculateHaversineRouteDistanceM, profileRoleSchema } from '@/domain/schemas';
import { canMerchantPublishRequest } from '@/domain/states';
import { createClient } from '@/server/supabase/server';
import type { Database, TablesInsert } from '@/types/database.types';
import { createDeliveryRequestSchema } from './schemas';

type AppSupabaseClient = SupabaseClient<Database, 'public', 'public', Database['public']>;

export interface CreateDeliveryRequestResult {
  readonly requestId: string;
  readonly redirectTo: string;
}

export async function createDeliveryRequestAction(
  input: unknown
): Promise<ActionResult<CreateDeliveryRequestResult, DomainErrorCode>> {
  const supabase = (await createClient()) as unknown as AppSupabaseClient;

  // 1. Verificación de sesión de autenticación
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return err('UNAUTHENTICATED');
  }

  // 2. Verificación de rol del actor (merchant obligatorio)
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

  // 3. Verificación de suscripción o piloto activo (canMerchantPublishRequest)
  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('subscription_status, paid_until')
    .eq('profile_id', user.id)
    .maybeSingle<{
      subscription_status: Database['public']['Enums']['merchant_subscription_status'];
      paid_until: string | null;
    }>();

  if (merchantError || !merchant) {
    return err('SUBSCRIPTION_INACTIVE');
  }

  const { data: settingsData } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', ['pilot_active', 'subscription_grace_days']);

  let pilotActive = true;
  let subscriptionGraceDays = 0;

  if (Array.isArray(settingsData)) {
    for (const s of settingsData as Array<{ key: string; value: unknown }>) {
      if (s.key === 'pilot_active' && typeof s.value === 'boolean') {
        pilotActive = s.value;
      }
      if (s.key === 'subscription_grace_days' && typeof s.value === 'number') {
        subscriptionGraceDays = s.value;
      }
    }
  }

  const eligibility = canMerchantPublishRequest({
    subscriptionStatus: merchant.subscription_status,
    pilotActive,
    paidUntil: merchant.paid_until,
    graceDays: subscriptionGraceDays,
    now: new Date(),
  });

  if (!eligibility.ok) {
    return err(eligibility.code);
  }

  // 4. Validación de datos de entrada con Zod
  const parsed = createDeliveryRequestSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  const data = parsed.data;

  // 5. Cálculo de distancia server-side (Haversine con factor 1.30 o centroides de zones)
  let routeDistanceM: number | null = null;

  if (
    data.pickupLat != null &&
    data.pickupLng != null &&
    data.dropoffLat != null &&
    data.dropoffLng != null
  ) {
    routeDistanceM = calculateHaversineRouteDistanceM(
      { lat: data.pickupLat, lng: data.pickupLng },
      { lat: data.dropoffLat, lng: data.dropoffLng }
    );
  } else {
    // Fallback: consulta centroides de los barrios seleccionados
    const { data: zones } = await supabase
      .from('zones')
      .select('id, centroid_lat, centroid_lng')
      .in('id', [data.pickupZoneId, data.dropoffZoneId]);

    if (Array.isArray(zones) && zones.length > 0) {
      const pickupZone = zones.find((z) => z.id === data.pickupZoneId);
      const dropoffZone = zones.find((z) => z.id === data.dropoffZoneId);

      if (
        pickupZone?.centroid_lat != null &&
        pickupZone?.centroid_lng != null &&
        dropoffZone?.centroid_lat != null &&
        dropoffZone?.centroid_lng != null
      ) {
        routeDistanceM = calculateHaversineRouteDistanceM(
          { lat: pickupZone.centroid_lat, lng: pickupZone.centroid_lng },
          { lat: dropoffZone.centroid_lat, lng: dropoffZone.centroid_lng }
        );
      }
    }
  }

  // 6. Inserción en delivery_requests (status 'draft')
  const requestPayload: TablesInsert<'delivery_requests'> = {
    merchant_id: user.id,
    pickup_zone_id: data.pickupZoneId,
    dropoff_zone_id: data.dropoffZoneId,
    package_type: data.packageType,
    recipient_payment_method: data.recipientPaymentMethod,
    needs_change: data.needsChange,
    cash_change_amount: data.cashChangeAmount,
    notes: data.notes ?? null,
    status: 'draft',
    route_distance_m: routeDistanceM,
    approx_distance_m: routeDistanceM,
  };

  const { data: createdRequest, error: requestInsertError } = await supabase
    .from('delivery_requests')
    .insert(requestPayload)
    .select('id')
    .single<{ id: string }>();

  if (requestInsertError || !createdRequest) {
    return err('INTERNAL_ERROR');
  }

  // 7. Inserción en delivery_request_contacts
  const contactsPayload: TablesInsert<'delivery_request_contacts'> = {
    request_id: createdRequest.id,
    pickup_address: data.pickupAddress,
    pickup_lat: data.pickupLat ?? null,
    pickup_lng: data.pickupLng ?? null,
    dropoff_address: data.dropoffAddress,
    dropoff_lat: data.dropoffLat ?? null,
    dropoff_lng: data.dropoffLng ?? null,
    recipient_name: data.recipientName,
    recipient_phone: data.recipientPhone,
    recipient_consent_declared: data.recipientConsentDeclared,
  };

  const { error: contactsInsertError } = await supabase
    .from('delivery_request_contacts')
    .insert(contactsPayload);

  if (contactsInsertError) {
    return err('INTERNAL_ERROR');
  }

  return ok({
    requestId: createdRequest.id,
    redirectTo: '/merchant/requests',
  });
}
