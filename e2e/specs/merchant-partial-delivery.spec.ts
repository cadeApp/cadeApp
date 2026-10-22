import { randomUUID } from 'node:crypto';
import {
  test,
  expect,
  assertAllowedE2EEnvironment,
  createAuthenticatedClient,
  trackEntityForCleanup,
} from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { createAdminClient } from '@/server/supabase/admin';

/**
 * T-393: una solicitud de 2 entregas con una entregada y otra no entregada cierra en `delivered` (CC-022 §6), pero el
 * comercio tiene que ver el resultado real: «Entrega parcial», «1 de 2 entregadas», el estado de cada entrega y el
 * motivo, en el detalle del viaje y en el historial.
 */

const FAILED_REASON = 'El destinatario no responde';

test.describe('T-393 — Comercio: entregas parciales', () => {
  test('detalle e historial muestran la entrega parcial con su motivo', async ({
    page,
    loginAsMerchant,
    stagingContext,
  }) => {
    assertAllowedE2EEnvironment();

    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    if (!merchant || !courier) {
      throw new Error('[E2E Error] Se requieren merchant y courier en stagingContext');
    }

    const admin = createAdminClient();
    const requestId = randomUUID();
    const deliveredDropId = randomUUID();
    const failedDropId = randomUUID();
    trackEntityForCleanup(stagingContext, 'request', requestId);

    const { data: zones } = await admin.from('zones').select('id').eq('active', true).limit(1);
    const zoneId = zones?.[0]?.id;
    if (!zoneId) throw new Error('[E2E Error] Se requiere al menos una zona activa');

    // Borrador de 2 entregas como fixture (D03 = C); la publicación la hace el comercio con su RPC.
    const { error: reqErr } = await admin.from('delivery_requests').insert({
      id: requestId,
      merchant_id: merchant.id,
      pickup_zone_id: zoneId,
      status: 'draft',
      drops_count: 2,
    });
    expect(reqErr).toBeNull();
    const { error: contactErr } = await admin.from('delivery_request_contacts').insert({
      request_id: requestId,
      pickup_address: 'Pellegrini y French',
    });
    expect(contactErr).toBeNull();
    const { error: dropsErr } = await admin.from('delivery_request_drops').insert([
      {
        id: deliveredDropId,
        request_id: requestId,
        position: 1,
        dropoff_zone_id: zoneId,
        package_type: 'chico',
        recipient_payment_method: 'transfer',
        needs_change: false,
        status: 'pending',
      },
      {
        id: failedDropId,
        request_id: requestId,
        position: 2,
        dropoff_zone_id: zoneId,
        package_type: 'chico',
        recipient_payment_method: 'cash',
        needs_change: false,
        status: 'pending',
      },
    ]);
    expect(dropsErr).toBeNull();
    const { error: dropContactsErr } = await admin.from('delivery_request_drop_contacts').insert([
      {
        drop_id: deliveredDropId,
        dropoff_address: 'Camino a Monte Rico',
        recipient_name: 'Cliente Entregado',
        recipient_phone: '3865100000',
        recipient_consent_declared: true,
      },
      {
        drop_id: failedDropId,
        dropoff_address: 'Pasaje Avellaneda 1300',
        recipient_name: 'Cliente Sin Entregar',
        recipient_phone: '3865200000',
        recipient_consent_declared: true,
      },
    ]);
    expect(dropContactsErr).toBeNull();

    // Ciclo real por RPC: publicación del comercio, oferta, aceptación, retiro, una entrega hecha y otra no.
    const merchantClient = await createAuthenticatedClient(merchant);
    const { error: publishErr } = await merchantClient.rpc('publish_request', { p_request_id: requestId });
    expect(publishErr).toBeNull();
    const { data: published } = await admin
      .from('delivery_requests')
      .select('status')
      .eq('id', requestId)
      .single();
    expect(published?.status).toBe('published');

    const courierClient = await createAuthenticatedClient(courier);
    const { data: offerData, error: offerErr } = await courierClient.rpc('submit_offer', {
      p_request_id: requestId,
      p_amount_ars: 1200,
      p_eta_minutes: 15,
      p_message: 'Oferta T-393',
    });
    expect(offerErr).toBeNull();
    const offerId = (offerData as { offerId: string } | null)?.offerId;
    if (!offerId) throw new Error('[E2E Error] submit_offer no devolvió offerId');
    trackEntityForCleanup(stagingContext, 'offer', offerId);

    const { error: acceptErr } = await merchantClient.rpc('accept_offer', { p_offer_id: offerId });
    expect(acceptErr).toBeNull();
    const { error: pickupErr } = await courierClient.rpc('mark_picked_up', { p_request_id: requestId });
    expect(pickupErr).toBeNull();
    const { error: deliveredErr } = await courierClient.rpc('mark_drop_delivered', {
      p_drop_id: deliveredDropId,
    });
    expect(deliveredErr).toBeNull();
    const { error: failedErr } = await courierClient.rpc('mark_drop_failed', {
      p_drop_id: failedDropId,
      p_reason: FAILED_REASON,
    });
    expect(failedErr).toBeNull();

    const { data: closed } = await admin
      .from('delivery_requests')
      .select('status')
      .eq('id', requestId)
      .single();
    expect(closed?.status).toBe('delivered');

    // Detalle del viaje del comercio.
    await loginAsMerchant(page);
    await page.goto(`/trips/${requestId}`);
    await waitForNoSkeletons(page);

    await expect(page.getByRole('heading', { name: 'Viaje finalizado' })).toBeVisible();
    await expect(page.getByText('Entrega parcial', { exact: true })).toBeVisible();
    await expect(page.getByText('1 de 2 entregadas').first()).toBeVisible();
    await expect(page.getByText('Entregado', { exact: true })).toHaveCount(0);

    const deliveredCard = page
      .locator('[class*="shadow-card"]')
      .filter({ has: page.getByRole('heading', { name: /\(Entrega 1\)/ }) });
    await expect(deliveredCard.getByText('Entregada', { exact: true })).toBeVisible();
    const failedCard = page
      .locator('[class*="shadow-card"]')
      .filter({ has: page.getByRole('heading', { name: /\(Entrega 2\)/ }) });
    await expect(failedCard.getByText('No entregada', { exact: true })).toBeVisible();
    await expect(failedCard.getByText(`Motivo: ${FAILED_REASON}`)).toBeVisible();

    // Historial: sigue en «Entregadas» pero con la etiqueta real.
    await page.goto('/merchant/history?status=delivered');
    await waitForNoSkeletons(page);
    const historyCard = page.locator(`a[href="/merchant/requests/${requestId}"]`);
    await expect(historyCard).toBeVisible();
    await expect(historyCard.getByText('Entrega parcial · 1 de 2')).toBeVisible();
    await expect(historyCard.getByText('Entregada', { exact: true })).toHaveCount(0);
  });
});
