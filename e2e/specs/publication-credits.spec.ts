import { test, expect, findRequestIdByNotesMarker } from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { createAdminClient } from '@/server/supabase/admin';

/**
 * T-369 / CC-029 paso 3: créditos de publicación con el piloto activo (proyecto chromium).
 *
 * No cambia `platform_settings`: exige que el piloto esté encendido, que es el estado de Develop y staging hasta que
 * Lautaro073 decida apagarlo. Con el piloto activo, publicar no crea cargos (ni reserva ni consumo) y Mi plan dice que
 * publicar es gratis. Los casos con el piloto apagado están en `publication-credits.global-settings.spec.ts`.
 */

test.describe('T-369 — créditos con el piloto activo (CC-029)', () => {
  test('piloto activo: publicar no reserva ni consume créditos y Mi plan dice que es gratis', async ({
    page,
    merchantPage,
    stagingContext,
    loginAsMerchant,
  }) => {
    const merchant = stagingContext.merchantUser;
    if (!merchant) throw new Error('[E2E Error] No merchant user in stagingContext');
    const admin = createAdminClient();

    const { data: pilot, error: pilotErr } = await admin
      .from('platform_settings')
      .select('value')
      .eq('key', 'pilot_active')
      .single();
    expect(pilotErr).toBeNull();
    // Precondición fail-closed: este spec no apaga ni enciende el piloto.
    expect(pilot?.value, 'el piloto tiene que estar encendido en este ambiente').toBe(true);

    await loginAsMerchant(page);
    await page.goto('/merchant/plan');
    await waitForNoSkeletons(page);
    const plan = page.getByRole('region', { name: 'Mi plan' });
    await expect(plan.getByText('Estás en el piloto gratis')).toBeVisible();
    await expect(
      plan.getByText('Publicar es gratis e ilimitado mientras dure el piloto. No se usan créditos.')
    ).toBeVisible();

    const notesMarker = `E2E credits pilot ${stagingContext.testRunId}`;
    await merchantPage.gotoNewRequest();
    await waitForNoSkeletons(page);
    if (!(await merchantPage.pickupAddressInput.inputValue()).trim()) {
      await merchantPage.pickupAddressInput.fill('San Martín 150');
    }
    await merchantPage.dropoffAddressInput.fill('Av. Mitre 450');
    await merchantPage.recipientNameInput.fill('Destinatario E2E');
    await merchantPage.recipientPhoneInput.fill('3865123456');
    await merchantPage.consentCheckbox.check();
    await merchantPage.packageChicoButton.click();
    await merchantPage.paymentCashButton.click();
    await merchantPage.notesInput.fill(notesMarker);
    await merchantPage.submitRequestButton.click();
    await page.waitForURL((url) => !url.pathname.endsWith('/requests/new'), { timeout: 15_000 });

    const requestId = await findRequestIdByNotesMarker(stagingContext, notesMarker);
    const { data: row, error: rowErr } = await admin
      .from('delivery_requests')
      .select('status')
      .eq('id', requestId)
      .single();
    expect(rowErr).toBeNull();
    expect(row?.status).toBe('published');

    const { data: charges, error: chargesErr } = await admin
      .from('publication_charges')
      .select('id')
      .eq('request_id', requestId);
    expect(chargesErr).toBeNull();
    expect(charges ?? []).toHaveLength(0);
    const { data: movements, error: movementsErr } = await admin
      .from('publication_credit_movements')
      .select('id')
      .eq('merchant_id', merchant.id);
    expect(movementsErr).toBeNull();
    expect(movements ?? []).toHaveLength(0);
  });
});
