import {
  test,
  expect,
  seedOffersForFirstRequest,
  getRequestInspectionData,
  createAuthenticatedClient,
} from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { createAdminClient } from '@/server/supabase/admin';
import { formatArs } from '@/lib/format';

/**
 * T-342: el feed del repartidor no muestra indicaciones ni monto exacto de cambio antes del match (D3).
 *
 * DoD:
 * - el repartidor no aceptado ve el medio de pago y «Necesita cambio», pero no el monto ni el texto de las
 *   indicaciones, en el feed ni en la hoja de oferta;
 * - después de aceptar, la vista del viaje sí muestra los dos.
 *
 * La solicitud sembrada ya trae indicaciones (`notes`, marcador de la corrida). El spec solo le agrega
 * efectivo con cambio y monto con el cliente de administración del fixture; no toca el marcador.
 */

const CHANGE_AMOUNT = 5000;

test.describe('T-342 — privacidad del feed del repartidor antes del match', () => {
  test('DoD: antes del match no se ven indicaciones ni monto de cambio; después de aceptar sí', async ({
    page,
    stagingContext,
    loginAsCourier,
  }) => {
    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    const requestId = stagingContext.createdRequestIds[0];
    if (!merchant || !courier || !requestId) {
      throw new Error('[E2E Precondition Error] Se requieren merchant, courier 0 y una solicitud sembrada');
    }

    // 1. Precondición: efectivo + necesita cambio + monto exacto, con las indicaciones sembradas
    const admin = createAdminClient();
    const { data: seeded, error: seedErr } = await admin
      .from('delivery_requests')
      .update({ recipient_payment_method: 'cash', needs_change: true, cash_change_amount: CHANGE_AMOUNT })
      .eq('id', requestId)
      .select('notes')
      .single();
    if (seedErr || !seeded?.notes) {
      throw new Error(`[E2E Seed Error] Falló la preparación de la solicitud: ${seedErr?.message ?? 'sin notes'}`);
    }
    const notes = seeded.notes;
    const amountLabel = formatArs(CHANGE_AMOUNT);

    // 2. Feed del repartidor no aceptado
    await loginAsCourier(0, page);
    await page.goto('/courier/feed');
    await waitForNoSkeletons(page);

    const cardsWithChange = page.getByTestId('request-card').filter({ hasText: /necesita cambio/i });
    await expect(cardsWithChange.first()).toBeVisible();
    await expect(page.getByText(/paga en efectivo/i).first()).toBeVisible();

    // Ninguna tarjeta del feed muestra indicaciones ni monto de cambio (incluida la sembrada)
    await expect(page.getByText(notes)).toHaveCount(0);
    await expect(page.getByText(/indicaciones/i)).toHaveCount(0);
    for (const badgeText of await page.getByText(/necesita cambio/i).allTextContents()) {
      expect(badgeText.trim()).toBe('Necesita cambio');
    }

    // 3. Hoja de oferta de una solicitud que necesita cambio
    await cardsWithChange.first().getByRole('button', { name: /^ofertar$/i }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(/necesita cambio/i)).toHaveText('Necesita cambio');
    await expect(sheet.getByText(/indicaciones/i)).toHaveCount(0);
    await expect(sheet.getByText(notes)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    // 4. El comercio acepta la oferta del courier 0 (RPC real con sesión del comercio)
    await seedOffersForFirstRequest(stagingContext);
    const before = await getRequestInspectionData(stagingContext, requestId);
    const courierOffer = before.offers.find((o) => o.courierId === courier.id && o.status === 'pending');
    if (!courierOffer) {
      throw new Error('[E2E Precondition Error] No hay oferta pending del courier 0');
    }
    const merchantClient = await createAuthenticatedClient(merchant);
    const { error: acceptErr } = await merchantClient.rpc('accept_offer', { p_offer_id: courierOffer.id });
    expect(acceptErr).toBeNull();

    // 5. Después del match, la vista del viaje del repartidor aceptado muestra los dos datos
    await page.goto(`/trips/${requestId}`);
    await waitForNoSkeletons(page);
    await expect(page.getByText(notes)).toBeVisible();
    await expect(page.getByText(`necesita cambio de ${amountLabel}`)).toBeVisible();
  });
});
