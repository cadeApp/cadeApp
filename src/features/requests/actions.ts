'use server';

import { type ActionResult, type DomainErrorCode, err, ok } from '@/domain/errors';
import { profileRoleSchema } from '@/domain/schemas';
import { callRequestRpc } from '@/server/rpc/requests';
import { createClient } from '@/server/supabase/server';
import type { TablesInsert } from '@/types/database.types';
import { createDeliveryRequestSchema } from './schemas';

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

  // 3. Validación de datos de entrada con Zod
  const parsed = createDeliveryRequestSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  const data = parsed.data;

  // 4. Inserción en delivery_requests (status 'draft')
  // CC-022 §10 Paso 4: Sin campos legacy de destino, notas ni cambio
  const requestPayload: TablesInsert<'delivery_requests'> = {
    ...(data.requestId ? { id: data.requestId } : {}),
    merchant_id: user.id,
    pickup_zone_id: data.pickupZoneId,
    status: 'draft',
    notes: null,
    cash_change_amount: null,
    fixed_price_ars: data.fixedPriceArs ?? null,
    auto_assign: data.autoAssign ?? false,
    drops_count: data.drops.length,
  };

  const { data: createdRequest, error: requestInsertError } = await supabase
    .from('delivery_requests')
    .insert(requestPayload as never)
    .select('id')
    .single<{ id: string }>();

  if (requestInsertError || !createdRequest) {
    return err('INTERNAL_ERROR');
  }

  // 5. Inserción en delivery_request_contacts (solo datos de retiro)
  const contactsPayload: TablesInsert<'delivery_request_contacts'> = {
    request_id: createdRequest.id,
    pickup_address: data.pickupAddress,
    pickup_lat: data.pickupLat ?? null,
    pickup_lng: data.pickupLng ?? null,
    dropoff_address: null,
    dropoff_lat: null,
    dropoff_lng: null,
    recipient_name: null,
    recipient_phone: null,
    recipient_consent_declared: null,
  };

  const { error: contactsInsertError } = await supabase
    .from('delivery_request_contacts')
    .insert(contactsPayload as never);

  if (contactsInsertError) {
    return err('INTERNAL_ERROR');
  }

  // 6. Inserción en delivery_request_drops (position 1..N)
  const dropsPayload: TablesInsert<'delivery_request_drops'>[] = data.drops.map(
    (drop, index) => ({
      request_id: createdRequest.id,
      position: index + 1,
      dropoff_zone_id: drop.dropoffZoneId,
      package_type: drop.packageType,
      recipient_payment_method: drop.recipientPaymentMethod,
      needs_change: drop.recipientPaymentMethod === 'cash' ? drop.needsChange : false,
    })
  );

  const { data: createdDrops, error: dropsInsertError } = await supabase
    .from('delivery_request_drops')
    .insert(dropsPayload as never)
    .select('id, position');

  if (
    dropsInsertError ||
    !createdDrops ||
    (createdDrops as Array<{ id: string; position: number }>).length !== data.drops.length
  ) {
    return err('INTERNAL_ERROR');
  }

  // Mapear por position (NUNCA asumir orden de retorno)
  const dropByPosition = new Map<number, string>(
    (createdDrops as Array<{ id: string; position: number }>).map((d) => [d.position, d.id])
  );

  for (let i = 0; i < data.drops.length; i++) {
    if (!dropByPosition.has(i + 1)) {
      return err('INTERNAL_ERROR');
    }
  }

  // 7. Inserción en delivery_request_drop_contacts (datos privados por entrega)
  const dropContactsPayload: TablesInsert<'delivery_request_drop_contacts'>[] = [];
  for (let i = 0; i < data.drops.length; i++) {
    const drop = data.drops[i];
    if (!drop) {
      return err('INTERNAL_ERROR');
    }
    const dropId = dropByPosition.get(i + 1);
    if (!dropId) {
      return err('INTERNAL_ERROR');
    }
    dropContactsPayload.push({
      drop_id: dropId,
      dropoff_address: drop.dropoffAddress,
      dropoff_lat: drop.dropoffLat ?? null,
      dropoff_lng: drop.dropoffLng ?? null,
      recipient_name: drop.recipientName,
      recipient_phone: drop.recipientPhone,
      recipient_consent_declared: drop.recipientConsentDeclared,
      cash_change_amount:
        drop.recipientPaymentMethod === 'cash' && drop.needsChange
          ? drop.cashChangeAmount
          : null,
      notes: drop.notes ?? null,
    });
  }

  const { error: dropContactsInsertError } = await supabase
    .from('delivery_request_drop_contacts')
    .insert(dropContactsPayload as never);

  if (dropContactsInsertError) {
    return err('INTERNAL_ERROR');
  }

  // 8. Publicación: la transición draft -> published y su autorización (suscripción/piloto,
  // zonas, bordes, rate limit, max_drops_per_request) las valida la RPC.
  const published = await callRequestRpc(supabase, 'publish_request', {
    requestId: createdRequest.id,
  });

  if (!published.ok) {
    return err(published.code);
  }

  return ok({
    requestId: createdRequest.id,
    redirectTo: '/merchant/dashboard',
  });
}
