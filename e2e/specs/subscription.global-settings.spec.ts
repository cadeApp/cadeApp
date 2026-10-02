import { test, expect, findRequestIdByNotesMarker } from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { createAdminClient } from '@/server/supabase/admin';
import type { Page } from '@playwright/test';
import type { MerchantPage } from '../pages';
import type { Json } from '@/types/database.types';

/**
 * T-306: E2E de piloto y suscripción (proyecto global-settings)
 *
 * Invariantes del producto probados en este spec:
 * 1. Con el piloto apagado (pilot_active = false) y paid_until en fecha pasada con
 *    subscription_status = 'active', el comercio no puede publicar solicitudes (bloqueo con
 *    SUBSCRIPTION_INACTIVE en UI y servidor).
 * 2. Con el piloto encendido (pilot_active = true), la publicación se realiza y la solicitud
 *    alcanza efectivamente el estado 'published'.
 * 3. Con el piloto apagado pero paid_until futuro (suscripción al día), la publicación se
 *    realiza y la solicitud alcanza efectivamente el estado 'published'.
 * 4. Los settings de la plataforma (platform_settings) se leen y restauran de forma fail-closed
 *    a su valor original exacto en el bloque finally de cada prueba.
 */

// Ejecución serial estricta requerida para specs que alteran platform_settings
test.describe.configure({ mode: 'serial' });

async function getPlatformSettingPilotActive(): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('platform_settings')
    .select('value')
    .eq('key', 'pilot_active')
    .single();

  if (error || !data || typeof data.value !== 'boolean') {
    throw new Error(
      `[E2E Subscription Fail-Closed] No se pudo leer el valor booleano original de platform_settings.pilot_active: ${error?.message ?? 'valor no booleano'}`
    );
  }
  return data.value;
}

async function setPlatformSettingPilotActive(active: boolean): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('platform_settings')
    .update({ value: active as unknown as Json })
    .eq('key', 'pilot_active')
    .select('value')
    .single();

  if (error || !data || data.value !== active) {
    throw new Error(
      `[E2E Subscription Fail-Closed] Error al actualizar pilot_active a ${active}: ${error?.message ?? 'el valor no quedó aplicado'}`
    );
  }
}

async function setMerchantSubscription(
  merchantId: string,
  status: 'pilot' | 'active' | 'expired' | 'cancelled',
  paidUntil: string | null
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('merchants')
    .update({
      subscription_status: status,
      paid_until: paidUntil,
    })
    .eq('profile_id', merchantId);

  if (error) {
    throw new Error(
      `[E2E Subscription Fail-Closed] Error al actualizar estado de suscripción de ${merchantId}: ${error.message}`
    );
  }
}

async function fillAndSubmitRequestForm(
  page: Page,
  merchantPage: MerchantPage,
  notesMarker: string
): Promise<void> {
  await merchantPage.gotoNewRequest();
  await waitForNoSkeletons(page);

  const pickupVal = await merchantPage.pickupAddressInput.inputValue();
  if (!pickupVal.trim()) {
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
}

test.describe('T-306 — Suite E2E de piloto y suscripción', () => {
  // ---------------------------------------------------------------------------
  // DoD 1: Piloto apagado + paid_until vencido -> Bloqueo de publicación (H02 / H04)
  // ---------------------------------------------------------------------------
  test('DoD 1: Con el piloto apagado y paid_until vencido no se publica (SUBSCRIPTION_INACTIVE)', async ({
    page,
    merchantPage,
    stagingContext,
    loginAsMerchant,
  }) => {
    const merchant = stagingContext.merchantUser;
    if (!merchant) throw new Error('[E2E Error] No merchant user in stagingContext');

    const admin = createAdminClient();
    const initialPilotActive = await getPlatformSettingPilotActive();

    try {
      // H02: pilot_active = false, subscription_status = 'active' y paid_until en fecha pasada
      await setPlatformSettingPilotActive(false);
      await setMerchantSubscription(merchant.id, 'active', '2020-01-01');

      await loginAsMerchant(page);

      const notesMarker = `E2E blocked sub ${stagingContext.testRunId}`;
      await fillAndSubmitRequestForm(page, merchantPage, notesMarker);

      // No debe navegar a detalle; debe permanecer en /merchant/requests/new
      await expect(page).toHaveURL(/\/merchant\/requests\/new/);

      // Alerta de error de dominio en pantalla
      const alert = page.getByRole('alert').filter({
        hasText: /suscripción está vencida|SUBSCRIPTION_INACTIVE/i,
      });
      await expect(alert).toBeVisible();

      // H04: Aserción sobre el intento específico con su marcador unívoco
      const { data: publishedRows, error: publishedError } = await admin
        .from('delivery_requests')
        .select('id, status')
        .eq('merchant_id', merchant.id)
        .eq('notes', notesMarker)
        .eq('status', 'published');
      expect(publishedError).toBeNull();
      expect(publishedRows ?? []).toHaveLength(0);
    } finally {
      // H06: Restauración exacta a initialPilotActive y relectura
      await setPlatformSettingPilotActive(initialPilotActive);
      const restored = await getPlatformSettingPilotActive();
      expect(restored).toBe(initialPilotActive);
      await setMerchantSubscription(merchant.id, 'pilot', null);
    }
  });

  // ---------------------------------------------------------------------------
  // DoD 2: Piloto encendido -> Publicación real (H03 / H06)
  // ---------------------------------------------------------------------------
  test('DoD 2: Con el piloto encendido la solicitud sí se publica', async ({
    page,
    merchantPage,
    stagingContext,
    loginAsMerchant,
  }) => {
    const merchant = stagingContext.merchantUser;
    if (!merchant) throw new Error('[E2E Error] No merchant user in stagingContext');

    const admin = createAdminClient();
    const initialPilotActive = await getPlatformSettingPilotActive();

    try {
      await setPlatformSettingPilotActive(true);
      await setMerchantSubscription(merchant.id, 'pilot', null);

      await loginAsMerchant(page);

      const notesMarker = `E2E pilot active ${stagingContext.testRunId}`;
      await fillAndSubmitRequestForm(page, merchantPage, notesMarker);

      await page.waitForURL((url) => !url.pathname.endsWith('/requests/new'), {
        timeout: 10000,
      });
      await waitForNoSkeletons(page);

      const createdRequestId = await findRequestIdByNotesMarker(stagingContext, notesMarker);
      await merchantPage.gotoRequestDetail(createdRequestId);
      await waitForNoSkeletons(page);

      await expect(page.getByText(/paquete chico/i)).toBeVisible();

      // H03: Aserción sobre el estado de la fila en la base de datos (publicación real vía RPC)
      const { data: requestRow, error: requestError } = await admin
        .from('delivery_requests')
        .select('id, status')
        .eq('id', createdRequestId)
        .single();
      expect(requestError).toBeNull();
      expect(requestRow?.status).toBe('published');
    } finally {
      await setPlatformSettingPilotActive(initialPilotActive);
      const restored = await getPlatformSettingPilotActive();
      expect(restored).toBe(initialPilotActive);
    }
  });

  // ---------------------------------------------------------------------------
  // DoD 3: Piloto apagado + paid_until futuro -> Publicación real (H03 / H06)
  // ---------------------------------------------------------------------------
  test('DoD 3: Con el piloto apagado pero paid_until futuro sí se publica', async ({
    page,
    merchantPage,
    stagingContext,
    loginAsMerchant,
  }) => {
    const merchant = stagingContext.merchantUser;
    if (!merchant) throw new Error('[E2E Error] No merchant user in stagingContext');

    const admin = createAdminClient();
    const initialPilotActive = await getPlatformSettingPilotActive();

    const futureDate = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

    try {
      await setPlatformSettingPilotActive(false);
      await setMerchantSubscription(merchant.id, 'active', futureDate);

      await loginAsMerchant(page);

      const notesMarker = `E2E paid future ${stagingContext.testRunId}`;
      await fillAndSubmitRequestForm(page, merchantPage, notesMarker);

      await page.waitForURL((url) => !url.pathname.endsWith('/requests/new'), {
        timeout: 10000,
      });
      await waitForNoSkeletons(page);

      const createdRequestId = await findRequestIdByNotesMarker(stagingContext, notesMarker);
      await merchantPage.gotoRequestDetail(createdRequestId);
      await waitForNoSkeletons(page);

      await expect(page.getByText(/paquete chico/i)).toBeVisible();

      // H03: Aserción sobre el estado de la fila en la base de datos (publicación real vía RPC)
      const { data: requestRow, error: requestError } = await admin
        .from('delivery_requests')
        .select('id, status')
        .eq('id', createdRequestId)
        .single();
      expect(requestError).toBeNull();
      expect(requestRow?.status).toBe('published');
    } finally {
      await setPlatformSettingPilotActive(initialPilotActive);
      const restored = await getPlatformSettingPilotActive();
      expect(restored).toBe(initialPilotActive);
      await setMerchantSubscription(merchant.id, 'pilot', null);
    }
  });
});
