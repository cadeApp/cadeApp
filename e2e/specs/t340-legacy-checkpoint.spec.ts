import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  assertAllowedE2EEnvironment,
  findRequestIdByNotesMarker,
  trackEntityForCleanup,
  createAuthenticatedClient,
} from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { createAdminClient } from '@/server/supabase/admin';

/**
 * T-340 Gate 0: Verificación funcional de cliente legacy y puente multi-drop (CC-022 §10).
 *
 * Requisitos contractuales de entrada al Paso 2:
 * 1. UI legacy real publica una solicitud con 1 entrega -> materializa exactamente 1 drop
 *    en `delivery_request_drops` y su correspondiente `delivery_request_drop_contacts`.
 * 2. Reintento de publicación sobre la solicitud no duplica drops (`drops_count = 1`).
 * 3. Match autorizado y llamada real a RPC `get_trip_details` conserva `deliveryNotes`
 *    y `cashChangeAmount` sin pérdida de datos.
 * 4. Columnas legacy `notes` y `cash_change_amount` en `delivery_requests` permanecen intactas
 *    (la limpieza está reservada exclusivamente para el Paso 3).
 */

const CHANGE_AMOUNT = 5000;

test.describe('T-340 Gate 0 — Checkpoint funcional de compatibilidad legacy posmerge', () => {
  test('T-340 Gate 0: cliente legacy publica 1 drop, reintento sin duplicación, get_trip_details post-match y persistencia legacy', async ({
    page,
    merchantPage,
    stagingContext,
    loginAsMerchant,
  }) => {
    assertAllowedE2EEnvironment();

    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    if (!merchant || !courier) {
      throw new Error('[E2E Error] Se requiere merchantUser y al menos un courierUser en stagingContext');
    }

    const admin = createAdminClient();
    const notesMarker = `T340 Gate 0 ${stagingContext.testRunId}`;

    // -------------------------------------------------------------------------
    // Paso 1: Completar y enviar formulario UI legacy real
    // -------------------------------------------------------------------------
    await loginAsMerchant(page);
    await merchantPage.gotoNewRequest();
    await waitForNoSkeletons(page);

    const pickupVal = await merchantPage.pickupAddressInput.inputValue();
    if (!pickupVal.trim()) {
      await merchantPage.pickupAddressInput.fill('San Martín 150');
    }

    await merchantPage.dropoffAddressInput.fill('Av. Mitre 450');
    await merchantPage.recipientNameInput.fill('María Elena Walsh');
    await merchantPage.recipientPhoneInput.fill('3865123456');
    await merchantPage.consentCheckbox.check();

    await merchantPage.packageChicoButton.click();
    await merchantPage.paymentCashButton.click();
    await merchantPage.needsChangeYesButton.click();
    await merchantPage.changePresetButton(CHANGE_AMOUNT).click();

    await merchantPage.notesInput.fill(notesMarker);
    await merchantPage.submitRequestButton.click();

    await page.waitForURL((url) => !url.pathname.endsWith('/requests/new'), {
      timeout: 10000,
    });
    await waitForNoSkeletons(page);

    // Identificar solicitud creada y registrarla en el contexto para cleanup automático
    const createdRequestId = await findRequestIdByNotesMarker(stagingContext, notesMarker);
    expect(createdRequestId).toBeDefined();

    // -------------------------------------------------------------------------
    // Oráculo 1: UI legacy -> DB nueva (delivery_requests, drops, drop_contacts)
    // -------------------------------------------------------------------------
    const { data: reqRow, error: reqErr } = await admin
      .from('delivery_requests')
      .select('status, drops_count, notes, cash_change_amount')
      .eq('id', createdRequestId)
      .single();
    expect(reqErr).toBeNull();
    expect(reqRow?.status).toBe('published');
    expect(reqRow?.drops_count).toBe(1);

    const { data: dropsRows, error: dropsErr } = await admin
      .from('delivery_request_drops')
      .select('id, position, status, recipient_payment_method, needs_change')
      .eq('request_id', createdRequestId);
    expect(dropsErr).toBeNull();
    expect(dropsRows).toHaveLength(1);
    const drop = dropsRows?.[0];
    if (!drop) {
      throw new Error('[E2E Error] No se encontró el drop materializado');
    }
    expect(drop.position).toBe(1);
    expect(drop.recipient_payment_method).toBe('cash');
    expect(drop.needs_change).toBe(true);

    const { data: dropContacts, error: dropContactsErr } = await admin
      .from('delivery_request_drop_contacts')
      .select('notes, cash_change_amount, recipient_name, dropoff_address')
      .eq('drop_id', drop.id)
      .single();
    expect(dropContactsErr).toBeNull();
    expect(dropContacts?.notes).toBe(notesMarker);
    expect(dropContacts?.cash_change_amount).toBe(CHANGE_AMOUNT);

    // -------------------------------------------------------------------------
    // Oráculo 2: Reintento de publicación no duplica el drop (idempotencia / rechazo)
    // -------------------------------------------------------------------------
    const merchantClient = await createAuthenticatedClient(merchant);
    const { error: retryError } = await merchantClient.rpc('publish_request', {
      p_request_id: createdRequestId,
    });
    // La RPC valida status = 'draft'; al estar ya publicada, rechaza con INVALID_STATE_TRANSITION
    expect(retryError).not.toBeNull();
    expect(retryError?.message).toContain('INVALID_STATE_TRANSITION');

    const { data: reqAfterRetry, error: retryReqErr } = await admin
      .from('delivery_requests')
      .select('drops_count')
      .eq('id', createdRequestId)
      .single();
    expect(retryReqErr).toBeNull();
    expect(reqAfterRetry?.drops_count).toBe(1);

    const { data: dropsAfterRetry, error: retryDropsErr } = await admin
      .from('delivery_request_drops')
      .select('id')
      .eq('request_id', createdRequestId);
    expect(retryDropsErr).toBeNull();
    expect(dropsAfterRetry).toHaveLength(1);
    const retryDrop = dropsAfterRetry?.[0];
    if (!retryDrop) {
      throw new Error('[E2E Error] No se encontró el drop tras reintento');
    }
    expect(retryDrop.id).toBe(drop.id);

    // -------------------------------------------------------------------------
    // Oráculo 3: Match autorizado y lectura de get_trip_details (RPC real)
    // -------------------------------------------------------------------------
    const offerId = randomUUID();
    const { error: insertOfferErr } = await admin.from('offers').insert({
      id: offerId,
      request_id: createdRequestId,
      courier_id: courier.id,
      amount_ars: 2000,
      eta_minutes: 15,
      status: 'pending',
      message: 'Oferta checkpoint Gate 0',
    });
    if (insertOfferErr) {
      throw new Error(`[E2E Error] Falló creación de oferta de prueba: ${insertOfferErr.message}`);
    }
    trackEntityForCleanup(stagingContext, 'offer', offerId);

    const { error: acceptErr } = await merchantClient.rpc('accept_offer', {
      p_offer_id: offerId,
    });
    expect(acceptErr).toBeNull();

    const { data: reqMatched, error: matchCheckErr } = await admin
      .from('delivery_requests')
      .select('status, accepted_offer_id')
      .eq('id', createdRequestId)
      .single();
    expect(matchCheckErr).toBeNull();
    expect(reqMatched?.status).toBe('matched');
    expect(reqMatched?.accepted_offer_id).toBe(offerId);

    const courierClient = await createAuthenticatedClient(courier);
    const { data: tripDetails, error: tripErr } = await courierClient.rpc('get_trip_details', {
      p_request_id: createdRequestId,
    });
    expect(tripErr).toBeNull();
    expect(tripDetails).toBeDefined();
    const trip = tripDetails as {
      requestId?: string;
      deliveryNotes?: string | null;
      cashChangeAmount?: number | null;
      status?: string;
    } | null;
    expect(trip?.requestId).toBe(createdRequestId);
    expect(trip?.deliveryNotes).toBe(notesMarker);
    expect(trip?.cashChangeAmount).toBe(CHANGE_AMOUNT + 1000);
    expect(trip?.status).toBe('matched');

    // -------------------------------------------------------------------------
    // Oráculo 4: Persistencia y no limpieza prematura de columnas legacy
    // -------------------------------------------------------------------------
    const { data: finalReq, error: finalReqErr } = await admin
      .from('delivery_requests')
      .select('notes, cash_change_amount, drops_count')
      .eq('id', createdRequestId)
      .single();
    expect(finalReqErr).toBeNull();
    expect(finalReq?.notes).toBe(notesMarker);
    expect(finalReq?.cash_change_amount).toBe(CHANGE_AMOUNT);
    expect(finalReq?.drops_count).toBe(1);

    const { data: finalDropContacts, error: finalDropContactsErr } = await admin
      .from('delivery_request_drop_contacts')
      .select('notes, cash_change_amount')
      .eq('drop_id', drop.id)
      .single();
    expect(finalDropContactsErr).toBeNull();
    expect(finalDropContacts?.notes).toBe(notesMarker);
    expect(finalDropContacts?.cash_change_amount).toBe(CHANGE_AMOUNT);
  });
});
