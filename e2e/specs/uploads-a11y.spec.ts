import type { Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import {
  test,
  expect,
  createAuthenticatedClient,
  seedDeliveryRequestInState,
} from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { createAdminClient } from '@/server/supabase/admin';
import { COURIER_DOCS_BUCKET } from '@/features/courier-onboarding/upload-manager';

/**
 * T-309: E2E de carga de documentos con red lenta y accesibilidad.
 *
 * DoD:
 * 1. Con red 3G simulada y un corte, la carga se completa al reintentar.
 * 2. El servidor rechaza un archivo inválido.
 * 3. axe AA en login, crear solicitud, lista del repartidor, viaje y onboarding.
 */

// Tags WCAG 2.0, 2.1 y 2.2 Niveles A y AA exigidos formalmente
export const REQUIRED_WCAG_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22a',
  'wcag22aa',
] as const;

export async function runAxeAudit(page: Page, _contextDescription: string) {
  return new AxeBuilder({ page })
    .withTags([...REQUIRED_WCAG_TAGS])
    .analyze();
}

// Buffer JPEG mínimo válido de 1x1 píxel para pruebas de subida
const DUMMY_1X1_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
);

test.describe('T-309 — E2E de carga de documentos con red lenta y accesibilidad', () => {
  // ---------------------------------------------------------------------------
  // Contrato de tags de accesibilidad: garantiza inclusión estricta de WCAG 2.2
  // ---------------------------------------------------------------------------
  test('Contrato de tags de accesibilidad: cubre WCAG 2.0, 2.1 y 2.2 Niveles A y AA', () => {
    expect(REQUIRED_WCAG_TAGS).toEqual([
      'wcag2a',
      'wcag2aa',
      'wcag21a',
      'wcag21aa',
      'wcag22a',
      'wcag22aa',
    ]);
    expect(REQUIRED_WCAG_TAGS).toContain('wcag22a');
    expect(REQUIRED_WCAG_TAGS).toContain('wcag22aa');
  });

  // ---------------------------------------------------------------------------
  // DoD 1: Con red 3G simulada y un corte, la carga se completa al reintentar
  // ---------------------------------------------------------------------------
  test('DoD: Con red 3G simulada y un corte, la carga se completa al reintentar', async ({
    page,
    loginAsCourier,
  }) => {
    let uploadedStoragePath: string | null = null;

    try {
      // 1. Iniciar sesión como repartidor y navegar al formulario de identidad del onboarding
      await loginAsCourier(0, page);
      await page.goto('/courier/onboarding/identity');
      await waitForNoSkeletons(page);
      await expect(page).toHaveURL(/\/courier\/onboarding\/identity$/);

      // 2. Simular condiciones de red Slow 3G vía Chrome DevTools Protocol
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: ((500 * 1000) / 8) * 0.8, // 500 kbps
        uploadThroughput: ((500 * 1000) / 8) * 0.8,   // 500 kbps
        latency: 400,                                  // 400 ms RTT
      });

      // 3. Simular un corte transitorio de red interceptando la subida en Supabase Storage
      let simulatedCutActive = true;
      let cutIntercepted = false;

      await page.route('**/storage/v1/object/**', async (route) => {
        if (route.request().method() === 'POST' && simulatedCutActive) {
          cutIntercepted = true;
          await route.abort('failed');
          return;
        }
        await route.continue();
      });

      // 4. Localizar input mediante label accesible (H02: sin selectores CSS ni IDs frágiles)
      const dniFrontInput = page.getByLabel(/DNI frente/i);
      await expect(dniFrontInput).toBeAttached();

      // 5. Intentar la primera carga del frente del DNI durante el corte
      await dniFrontInput.setInputFiles({
        name: 'dni_front.jpg',
        mimeType: 'image/jpeg',
        buffer: DUMMY_1X1_JPEG,
      });

      // 6. Verificar que la pantalla muestra el error por rol accesible
      const alert = page.getByRole('alert');
      await expect(alert).toBeVisible({ timeout: 15000 });
      await expect(alert).toContainText(/Error al subir|reintentar/i);
      expect(cutIntercepted).toBe(true);

      // 7. Restablecer la conectividad (desactivar el corte de red)
      simulatedCutActive = false;

      // 8. Reintentar la subida del documento usando el MISMO selector accesible
      await dniFrontInput.setInputFiles({
        name: 'dni_front.jpg',
        mimeType: 'image/jpeg',
        buffer: DUMMY_1X1_JPEG,
      });

      // 9. Verificar éxito por role=status y lectura de storage path real (no clases ni data-status CSS)
      const statusElement = page.getByRole('status').filter({ hasText: /cargado/i });
      await expect(statusElement).toBeVisible({ timeout: 30000 });

      // Extraer y validar el storage path real guardado en sessionStorage
      const rawDocs = await page.evaluate(() => sessionStorage.getItem('cadeapp_onboarding_docs'));
      expect(rawDocs).toBeTruthy();
      const parsedDocs = JSON.parse(rawDocs!);
      expect(parsedDocs.dni_front).toBeTruthy();
      uploadedStoragePath = parsedDocs.dni_front;
      expect(uploadedStoragePath).toMatch(/^courier\/[a-f0-9-]+\/dni_front_\d+\.(jpe?g|png|webp)$/i);
    } finally {
      // H06: Cleanup del objeto real subido a Storage para no dejar basura residual
      if (uploadedStoragePath) {
        const admin = createAdminClient();
        const { error: removeError } = await admin.storage
          .from(COURIER_DOCS_BUCKET)
          .remove([uploadedStoragePath]);
        expect(removeError).toBeNull();
      }
    }
  });

  // ---------------------------------------------------------------------------
  // DoD 2: El servidor rechaza un archivo inválido
  // ---------------------------------------------------------------------------
  test('DoD: El servidor rechaza un archivo inválido', async ({
    stagingContext,
  }) => {
    const courier = stagingContext.courierUsers?.[0];
    if (!courier) {
      throw new Error('[E2E Error] No se encontró courier en stagingContext');
    }

    // 1. Crear cliente autenticado como repartidor
    const courierClient = await createAuthenticatedClient(courier);

    // 2. Intentar subir al bucket privado 'courier-docs' un tipo de archivo no permitido (text/plain / ejecutable)
    const invalidFilePayload = Buffer.from('console.log("invalid file test payload");');
    const invalidStoragePath = `courier/${courier.id}/dni_front_${Date.now()}.txt`;

    const { data, error } = await courierClient.storage
      .from(COURIER_DOCS_BUCKET)
      .upload(invalidStoragePath, invalidFilePayload, {
        contentType: 'text/plain',
        upsert: false,
      });

    // 3. El servidor de almacenamiento debe rechazar la subida
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/mime type not allowed|mime type|invalid|violates/i);
  });

  // ---------------------------------------------------------------------------
  // DoD 3: axe AA en login, crear solicitud, lista del repartidor, viaje y onboarding
  // ---------------------------------------------------------------------------
  test('DoD: axe AA en login, crear solicitud, lista del repartidor, viaje y onboarding', async ({
    browser,
    stagingContext,
    loginAsMerchant,
    loginAsCourier,
  }) => {
    // 1. Pantalla de acceso: login (/login) en contexto y page anónima (H03)
    const anonContext = await browser.newContext();
    try {
      const anonPage = await anonContext.newPage();
      await anonPage.goto('/login');
      await waitForNoSkeletons(anonPage);
      await expect(anonPage).toHaveURL(/\/login$/);
      const loginAudit = await runAxeAudit(anonPage, 'login (/login)');
      expect(
        loginAudit.violations,
        `Violaciones WCAG en Login:\n${JSON.stringify(loginAudit.violations, null, 2)}`
      ).toEqual([]);
      expect(loginAudit.passes.length).toBeGreaterThan(0);
    } finally {
      await anonContext.close();
    }

    // 2. Pantalla de comercio: crear solicitud (/merchant/requests/new) en contexto merchant propio (H03)
    const merchantContext = await browser.newContext();
    try {
      const merchantBrowserPage = await merchantContext.newPage();
      const { merchantPage } = await loginAsMerchant(merchantBrowserPage);
      await merchantPage.gotoNewRequest();
      await waitForNoSkeletons(merchantBrowserPage);
      await expect(merchantBrowserPage).toHaveURL(/\/merchant\/requests\/new$/);
      const createReqAudit = await runAxeAudit(merchantBrowserPage, 'crear solicitud (/merchant/requests/new)');
      expect(
        createReqAudit.violations,
        `Violaciones WCAG en Crear Solicitud:\n${JSON.stringify(createReqAudit.violations, null, 2)}`
      ).toEqual([]);
      expect(createReqAudit.passes.length).toBeGreaterThan(0);
    } finally {
      await merchantContext.close();
    }

    // 3, 4, 5. Pantallas de repartidor: feed, viaje y onboarding en OTRO contexto courier separado (H03)
    const courierContext = await browser.newContext();
    try {
      const courierBrowserPage = await courierContext.newPage();
      const { courierPage } = await loginAsCourier(0, courierBrowserPage);

      // 3. Lista del repartidor (/courier/feed)
      await courierPage.gotoFeed();
      await waitForNoSkeletons(courierBrowserPage);
      await expect(courierBrowserPage).toHaveURL(/\/courier\/feed$/);
      const feedAudit = await runAxeAudit(courierBrowserPage, 'lista del repartidor (/courier/feed)');
      expect(
        feedAudit.violations,
        `Violaciones WCAG en Lista del Repartidor:\n${JSON.stringify(feedAudit.violations, null, 2)}`
      ).toEqual([]);
      expect(feedAudit.passes.length).toBeGreaterThan(0);

      // 4. Pantalla operativa: viaje (/trips/:id) con solicitud real en estado matched (H04)
      const courier = stagingContext.courierUsers?.[0];
      if (!courier) {
        throw new Error('[E2E Error] No se encontró courier en stagingContext');
      }
      const seededTrip = await seedDeliveryRequestInState(stagingContext, {
        status: 'matched',
        assignedCourierId: courier.id,
        withContacts: true,
      });
      await courierBrowserPage.goto(`/trips/${seededTrip.requestId}`);
      await waitForNoSkeletons(courierBrowserPage);
      await expect(courierBrowserPage).toHaveURL(new RegExp(`/trips/${seededTrip.requestId}$`));
      const tripAudit = await runAxeAudit(courierBrowserPage, `viaje (/trips/${seededTrip.requestId})`);
      expect(
        tripAudit.violations,
        `Violaciones WCAG en Viaje:\n${JSON.stringify(tripAudit.violations, null, 2)}`
      ).toEqual([]);
      expect(tripAudit.passes.length).toBeGreaterThan(0);

      // 5. Pantalla de incorporación: onboarding (/courier/onboarding/identity)
      await courierBrowserPage.goto('/courier/onboarding/identity');
      await waitForNoSkeletons(courierBrowserPage);
      await expect(courierBrowserPage).toHaveURL(/\/courier\/onboarding\/identity$/);
      const onboardingAudit = await runAxeAudit(courierBrowserPage, 'onboarding (/courier/onboarding/identity)');
      expect(
        onboardingAudit.violations,
        `Violaciones WCAG en Onboarding:\n${JSON.stringify(onboardingAudit.violations, null, 2)}`
      ).toEqual([]);
      expect(onboardingAudit.passes.length).toBeGreaterThan(0);
    } finally {
      await courierContext.close();
    }
  });
});
