'use server';

import { type ActionResult, type DomainErrorCode, err, ok } from '@/domain/errors';
import { calculateHaversineRouteDistanceM, profileRoleSchema } from '@/domain/schemas';
import { callRequestRpc } from '@/server/rpc/requests';
import { createClient } from '@/server/supabase/server';
import type { TablesInsert } from '@/types/database.types';
import { createDeliveryRequestSchema } from './schemas';

interface ZoneCentroidRow {
  id: string;
  centroid_lat: number | null;
  centroid_lng: number | null;
}

export interface CreateDeliveryRequestResult {
  readonly requestId: string;
  readonly redirectTo: string;
}

export async function createDeliveryRequestAction(
  input: unknown
): Promise<ActionResult<CreateDeliveryRequestResult, DomainErrorCode>> {
  const supabase = await createClient();

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

  // 3. Validación de datos de entrada con Zod.
  // La suscripción/piloto no se chequea acá: la decide `publish_request` (paso 7).
  const parsed = createDeliveryRequestSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  const data = parsed.data;

  // 4. Cálculo de distancia server-side (Haversine con factor 1.30 o centroides de zones)
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
      .select<string, ZoneCentroidRow>('id, centroid_lat, centroid_lng')
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

  // 5. Inserción en delivery_requests (status 'draft')
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
    .insert(requestPayload as never)
    .select('id')
    .single<{ id: string }>();

  if (requestInsertError || !createdRequest) {
    return err('INTERNAL_ERROR');
  }

  // 6. Inserción en delivery_request_contacts
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
    .insert(contactsPayload as never);

  if (contactsInsertError) {
    return err('INTERNAL_ERROR');
  }

  // 7. Publicación: la transición draft -> published y su autorización (suscripción/piloto,
  // zonas, bordes, rate limit) las valida la RPC. Si rechaza, la solicitud queda en draft.
  const published = await callRequestRpc(supabase, 'publish_request', {
    requestId: createdRequest.id,
  });

  if (!published.ok) {
    return err(published.code);
  }

  return ok({
    requestId: createdRequest.id,
    redirectTo: '/merchant/requests',
  });
}
