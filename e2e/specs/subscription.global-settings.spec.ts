import { test, expect, findRequestIdByNotesMarker } from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { createAdminClient } from '@/server/supabase/admin';
import { createPilotGuard, createSupabasePilotStore, PILOT_BASELINE } from '../helpers/pilot';
import type { Page } from '@playwright/test';
import type { MerchantPage } from '../pages';

/**
 * T-306 / T-371: E2E de piloto y suscripción (proyecto global-settings)
 *
 * Invariantes del producto probados en este spec:
 * 1. Con el piloto apagado (pilot_active = false) y paid_until en fecha pasada con
 *    subscription_status = 'active' sin créditos ni plan ilimitado (CC-029 / develop), el comercio
 *    no puede publicar solicitudes (bloqueo con PUBLICATION_CREDITS_EXHAUSTED en servidor y
 *    alerta accesible en UI).
 * 2. Con el piloto encendido (pilot_active = true), la publicación se realiza y la solicitud
 *    alcanza efectivamente el estado 'published'.
 * 3. Con el piloto apagado pero paid_until futuro (suscripción al día), la publicación se
 *    realiza y la solicitud alcanza efectivamente el estado 'published'.
 * 4. pilot_active empieza en su valor base (true) y vuelve a él aunque la prueba expire: lo restauran
 *    el finally y los hooks afterEach/afterAll (T-375). Los campos de suscripción del comercio
 *    (subscription_status, paid_until) se restauran a su valor original exacto en el finally de cada prueba.
 */

// Ejecución serial estricta requerida para specs que alteran platform_settings
test.describe.configure({ mode: 'serial' });

interface MerchantSubscriptionSnapshot {
  status: 'pilot' | 'active' | 'expired' | 'cancelled';
  paidUntil: string | null;
}

const pilot = createPilotGuard(
  createSupabasePilotStore('E2E Subscription Fail-Closed'),
  'E2E Subscription Fail-Closed'
);

async function getMerchantSubscription(
  merchantId: string
): Promise<MerchantSubscriptionSnapshot> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('merchants')
    .select('subscription_status, paid_until')
    .eq('profile_id', merchantId)
    .single();

  if (error || !data || !data.subscription_status) {
    throw new Error(
      `[E2E Subscription Fail-Closed] Error al leer estado de suscripción inicial de ${merchantId}: ${error?.message ?? 'sin datos'}`
    );
  }

  return {
    status: data.subscription_status as MerchantSubscriptionSnapshot['status'],
    paidUntil: data.paid_until,
  };
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
  test.beforeAll(async () => {
    await pilot.assertBaseline();
  });

  test.afterEach(async () => {
    await pilot.restore();
  });

  test.afterAll(async () => {
    await pilot.restore();
  });

  // ---------------------------------------------------------------------------
  // DoD 1: Piloto apagado + paid_until vencido -> Bloqueo de publicación (H02 / H04 / T-371)
  // ---------------------------------------------------------------------------
  test('DoD 1: Con el piloto apagado y paid_until vencido no se publica (PUBLICATION_CREDITS_EXHAUSTED)', async ({
    page,
    merchantPage,
    stagingContext,
    loginAsMerchant,
  }) => {
    const merchant = stagingContext.merchantUser;
    if (!merchant) throw new Error('[E2E Error] No merchant user in stagingContext');

    const admin = createAdminClient();
    const initialSubscription = await getMerchantSubscription(merchant.id);

    try {
      // H02: pilot_active = false, subscription_status = 'active' y paid_until en fecha pasada
      await pilot.set(false);
      await setMerchantSubscription(merchant.id, 'active', '2020-01-01');

      // Precondiciones controladas: verificar configuración en base antes de interactuar
      const currentPilot = await pilot.read();
      expect(currentPilot).toBe(false);

      const currentSub = await getMerchantSubscription(merchant.id);
      expect(currentSub.status).toBe('active');
      expect(currentSub.paidUntil).toBe('2020-01-01');

      await loginAsMerchant(page);

      const notesMarker = `E2E blocked sub ${stagingContext.testRunId}`;
      await fillAndSubmitRequestForm(page, merchantPage, notesMarker);

      // No debe navegar a detalle; debe permanecer en /merchant/requests/new
      await expect(page).toHaveURL(/\/merchant\/requests\/new/);

      // Alerta de error de dominio en pantalla (contrato CC-029 post-piloto: PUBLICATION_CREDITS_EXHAUSTED)
      const alert = page.getByRole('alert').filter({
        hasText: /créditos suficientes para publicar|PUBLICATION_CREDITS_EXHAUSTED/i,
      });
      await expect(alert).toBeVisible();

      // H04: Aserción sobre el intento específico con su marcador unívoco en PostgreSQL
      // Comprobar ausencia de filas publicadas tanto en delivery_requests como en delivery_request_drop_contacts
      const { data: legacyRows, error: legacyError } = await admin
        .from('delivery_requests')
        .select('id, status')
        .eq('merchant_id', merchant.id)
        .eq('notes', notesMarker)
        .eq('status', 'published');
      expect(legacyError).toBeNull();
      expect(legacyRows ?? []).toHaveLength(0);

      const { data: dropContacts, error: dropContactsError } = await admin
        .from('delivery_request_drop_contacts')
        .select('drop_id, delivery_request_drops!inner(request_id, delivery_requests!inner(merchant_id, status))')
        .eq('notes', notesMarker)
        .eq('delivery_request_drops.delivery_requests.merchant_id', merchant.id)
        .eq('delivery_request_drops.delivery_requests.status', 'published');
      expect(dropContactsError).toBeNull();
      expect(dropContacts ?? []).toHaveLength(0);
    } finally {
      // H06 / T-371 / T-375: restauración al valor base del piloto y relectura
      try {
        await pilot.restore();
        const restored = await pilot.read();
        expect(restored).toBe(PILOT_BASELINE);
      } finally {
        // Restauración exacta de campos originales subscription_status y paid_until
        await setMerchantSubscription(
          merchant.id,
          initialSubscription.status,
          initialSubscription.paidUntil
        );
        const restoredSub = await getMerchantSubscription(merchant.id);
        expect(restoredSub.status).toBe(initialSubscription.status);
        expect(restoredSub.paidUntil).toBe(initialSubscription.paidUntil);
      }
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
    const initialSubscription = await getMerchantSubscription(merchant.id);

    try {
      await pilot.set(true);
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
      try {
        await pilot.restore();
        const restored = await pilot.read();
        expect(restored).toBe(PILOT_BASELINE);
      } finally {
        await setMerchantSubscription(
          merchant.id,
          initialSubscription.status,
          initialSubscription.paidUntil
        );
        const restoredSub = await getMerchantSubscription(merchant.id);
        expect(restoredSub.status).toBe(initialSubscription.status);
        expect(restoredSub.paidUntil).toBe(initialSubscription.paidUntil);
      }
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
    const initialSubscription = await getMerchantSubscription(merchant.id);

    const futureDate = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

    try {
      await pilot.set(false);
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
      try {
        await pilot.restore();
        const restored = await pilot.read();
        expect(restored).toBe(PILOT_BASELINE);
      } finally {
        await setMerchantSubscription(
          merchant.id,
          initialSubscription.status,
          initialSubscription.paidUntil
        );
        const restoredSub = await getMerchantSubscription(merchant.id);
        expect(restoredSub.status).toBe(initialSubscription.status);
        expect(restoredSub.paidUntil).toBe(initialSubscription.paidUntil);
      }
    }
  });
});
