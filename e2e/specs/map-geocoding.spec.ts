import { test, expect, assertAllowedE2EEnvironment, trackEntityForCleanup } from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { setupGoogleMapsMock } from '../helpers/google-maps-mock';
import { createAdminClient } from '@/server/supabase/admin';

/**
 * T-423 (CC-045): la dirección escrita de una entrega se ubica en el mapa con la Geocoding API.
 *
 * Google está simulado con el stub fail-closed (0 llamadas reales): `found` responde un punto dentro de Aguilares y
 * `fail` rechaza la consulta. El oráculo es la fila privada de la entrega en la base.
 */

const GEOCODED = { lat: -27.436111, lng: -65.612222 } as const;

async function publishedDropCoordinates(merchantId: string) {
  const admin = createAdminClient();
  const { data: request, error: requestError } = await admin
    .from('delivery_requests')
    .select('id')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  expect(requestError).toBeNull();
  if (!request) throw new Error('[E2E Error] No se encontró la solicitud publicada');

  const { data: drop, error: dropError } = await admin
    .from('delivery_request_drops')
    .select('id')
    .eq('request_id', request.id)
    .single();
  expect(dropError).toBeNull();
  if (!drop) throw new Error('[E2E Error] No se encontró la entrega');

  const { data: contact, error: contactError } = await admin
    .from('delivery_request_drop_contacts')
    .select('dropoff_lat, dropoff_lng')
    .eq('drop_id', drop.id)
    .single();
  expect(contactError).toBeNull();
  return { requestId: request.id, lat: contact?.dropoff_lat ?? null, lng: contact?.dropoff_lng ?? null };
}

test.describe('T-423 — ubicar en el mapa la dirección de entrega (Geocoding simulado)', () => {
  test('al salir del campo, la dirección pone el pin y la solicitud se publica con esas coordenadas', async ({
    page,
    stagingContext,
    loginAsMerchant,
    merchantPage,
  }) => {
    assertAllowedE2EEnvironment();
    const merchant = stagingContext.merchantUser;
    if (!merchant) throw new Error('[E2E Error] Se requiere merchant en stagingContext');
    await setupGoogleMapsMock(page, { geocode: { mode: 'found', ...GEOCODED } });

    await loginAsMerchant(page);
    await merchantPage.gotoNewRequest();
    await waitForNoSkeletons(page);

    const card = page.getByTestId('drop-card-0');
    const address = `Av. Sarmiento 1200 T423 ${stagingContext.testRunId}`;
    await card.locator('input[id^="dropoff-address-"]').fill(address);
    await card.locator('input[id^="dropoff-address-"]').press('Tab');

    await expect(card.getByTestId('map-picker')).toBeVisible();
    await expect(card.getByRole('status').filter({ hasText: 'Revisá que el pin esté en la puerta.' })).toBeVisible();
    await expect(card.getByText('Pin fijado')).toBeVisible();

    const calls = await page.evaluate(() => (window as unknown as { __geocodeCalls?: string[] }).__geocodeCalls ?? []);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(new RegExp(`^${address}, .*Aguilares, Tucumán, Argentina$`));

    await card.locator('input[id^="recipient-name-"]').fill('Destinatario T423');
    await card.locator('input[id^="recipient-phone-"]').fill('3865444444');
    await card.locator('input[id^="recipient-consent-"]').check();
    await page.getByRole('button', { name: /publicar solicitud/i }).click();
    await page.waitForURL(/\/merchant\/dashboard/, { timeout: 15000 });

    const published = await publishedDropCoordinates(merchant.id);
    trackEntityForCleanup(stagingContext, 'request', published.requestId);
    expect(published.lat).toBe(GEOCODED.lat);
    expect(published.lng).toBe(GEOCODED.lng);
  });

  test('si la Geocoding falla, avisa en línea, no inventa pin y la solicitud se publica igual', async ({
    page,
    stagingContext,
    loginAsMerchant,
    merchantPage,
  }) => {
    assertAllowedE2EEnvironment();
    const merchant = stagingContext.merchantUser;
    if (!merchant) throw new Error('[E2E Error] Se requiere merchant en stagingContext');
    await setupGoogleMapsMock(page, { geocode: { mode: 'fail' } });

    await loginAsMerchant(page);
    await merchantPage.gotoNewRequest();
    await waitForNoSkeletons(page);

    const card = page.getByTestId('drop-card-0');
    await card.locator('input[id^="dropoff-address-"]').fill(`Mitre 450 T423 ${stagingContext.testRunId}`);
    await card.locator('input[id^="dropoff-address-"]').press('Tab');

    await expect(
      card.getByRole('alert').filter({
        hasText: 'No pudimos ubicar la dirección. Podés marcar el punto en el mapa o seguir con la dirección escrita.',
      })
    ).toBeVisible();
    await expect(card.getByText('Pin fijado')).toHaveCount(0);

    await card.locator('input[id^="recipient-name-"]').fill('Destinatario T423 sin mapa');
    await card.locator('input[id^="recipient-phone-"]').fill('3865555555');
    await card.locator('input[id^="recipient-consent-"]').check();
    await page.getByRole('button', { name: /publicar solicitud/i }).click();
    await page.waitForURL(/\/merchant\/dashboard/, { timeout: 15000 });

    const published = await publishedDropCoordinates(merchant.id);
    trackEntityForCleanup(stagingContext, 'request', published.requestId);
    expect(published.lat).toBeNull();
    expect(published.lng).toBeNull();
  });
});
