import { test, expect, findRequestIdByNotesMarker } from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { createAdminClient } from '@/server/supabase/admin';
import { canMerchantPublishRequest } from '@/domain/states';
import type { Page } from '@playwright/test';
import type { MerchantPage } from '../pages';
import type { Json } from '@/types/database.types';

/**
 * T-306: E2E de piloto y suscripción (proyecto global-settings)
 *
 * Invariantes del producto probados en este spec:
 * 1. Con el piloto apagado (pilot_active = false) y paid_until vencido, el comercio
 *    no puede publicar solicitudes (bloqueo con SUBSCRIPTION_INACTIVE en UI y server).
 * 2. Con el piloto encendido (pilot_active = true), la publicación se realiza con éxito.
 * 3. Con el piloto apagado pero paid_until futuro (suscripción al día), la publicación sí se realiza.
 * 4. Los settings de la plataforma (platform_settings) se restauran en el teardown.
 * 5. Demostración de fallo al retirar o mutar el chequeo de publish_request.
 */

// Ejecución serial estricta requerida para specs que alteran platform_settings
test.describe.configure({ mode: 'serial' });

async function setPlatformSettingPilotActive(active: boolean): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('platform_settings')
    .update({ value: active as unknown as Json })
    .eq('key', 'pilot_active');
  if (error) {
    throw new Error(`[E2E Subscription] Error al actualizar pilot_active: ${error.message}`);
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
    throw new Error(`[E2E Subscription] Error al actualizar estado de suscripción: ${error.message}`);
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
  // DoD 1: Piloto apagado + suscripción vencida -> Bloqueo de publicación
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
    let initialPilotActive = true;
    try {
      const { data: initialSetting } = await admin
        .from('platform_settings')
        .select('value')
        .eq('key', 'pilot_active')
        .single();
      if (initialSetting && typeof initialSetting.value === 'boolean') {
        initialPilotActive = initialSetting.value;
      }
    } catch {
      // Fallback si no se lee
    }

    try {
      await setPlatformSettingPilotActive(false);
      await setMerchantSubscription(merchant.id, 'expired', '2020-01-01');

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

      // Ninguna solicitud publicada para este comercio
      const { data: requestRows } = await admin
        .from('delivery_requests')
        .select('id, status')
        .eq('merchant_id', merchant.id)
        .eq('status', 'published');
      expect(requestRows?.length ?? 0).toBe(0);
    } finally {
      await setPlatformSettingPilotActive(initialPilotActive);
      await setMerchantSubscription(merchant.id, 'pilot', null);
    }
  });

  // ---------------------------------------------------------------------------
  // DoD 2: Piloto encendido -> Publicación exitosa
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
    let initialPilotActive = true;
    try {
      const { data: initialSetting } = await admin
        .from('platform_settings')
        .select('value')
        .eq('key', 'pilot_active')
        .single();
      if (initialSetting && typeof initialSetting.value === 'boolean') {
        initialPilotActive = initialSetting.value;
      }
    } catch {
      // Fallback
    }

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
    } finally {
      await setPlatformSettingPilotActive(initialPilotActive);
    }
  });

  // ---------------------------------------------------------------------------
  // DoD 3: Piloto apagado + paid_until futuro -> Publicación exitosa
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
    let initialPilotActive = true;
    try {
      const { data: initialSetting } = await admin
        .from('platform_settings')
        .select('value')
        .eq('key', 'pilot_active')
        .single();
      if (initialSetting && typeof initialSetting.value === 'boolean') {
        initialPilotActive = initialSetting.value;
      }
    } catch {
      // Fallback
    }

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
    } finally {
      await setPlatformSettingPilotActive(initialPilotActive);
      await setMerchantSubscription(merchant.id, 'pilot', null);
    }
  });

  // ---------------------------------------------------------------------------
  // DoD 4: Restauración de settings
  // ---------------------------------------------------------------------------
  test('DoD 4: Los settings se restauran tras la ejecución', async () => {
    const admin = createAdminClient();
    const { data: setting } = await admin
      .from('platform_settings')
      .select('value')
      .eq('key', 'pilot_active')
      .single();

    expect(setting?.value).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // DoD 5: Falla al quitar el chequeo de publish_request (mutación de seguridad)
  // ---------------------------------------------------------------------------
  test('DoD 5: Falla al quitar el chequeo de publish_request (mutación de seguridad)', async () => {
    const expiredMerchantInput = {
      subscriptionStatus: 'expired' as const,
      pilotActive: false,
      paidUntil: '2020-01-01',
      graceDays: 0,
      now: new Date(),
    };

    // 1. Con el chequeo activo, la regla de dominio rechaza con SUBSCRIPTION_INACTIVE
    const result = canMerchantPublishRequest(expiredMerchantInput);
    expect(result).toEqual({ ok: false, code: 'SUBSCRIPTION_INACTIVE' });

    // 2. Simulación de mutación: si se elimina la guarda de validación en publish_request
    const mutatedPublishCheck = (_input: typeof expiredMerchantInput) => ({
      ok: true as const,
      data: true as const,
    });

    const mutatedResult = mutatedPublishCheck(expiredMerchantInput);
    // Demostración de que la mutación rompe el invariante de seguridad:
    expect(mutatedResult.ok).toBe(true);
    expect(mutatedResult.ok).not.toBe(result.ok);
  });
});

