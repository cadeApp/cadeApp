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

// Buffer PNG real 2x2 válido para pruebas de subida (H11)
const DUMMY_2X2_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8//8/AwMDEwMDAwMDAwAkBgMB/DXemwAAAABJRU5ErkJggg==',
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
    const uploadTracker: { capturedStoragePath: string | null } = {
      capturedStoragePath: null,
    };

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
        if (route.request().method() === 'POST') {
          if (simulatedCutActive) {
            cutIntercepted = true;
            await route.abort('failed');
            return;
          }

          // H06: Capturar path candidato desde la URL del POST real ANTES de route.continue()
          const requestUrl = route.request().url();
          const match = requestUrl.match(/\/storage\/v1\/object\/courier-docs\/(.+?)(\?.*)?$/);
          if (match?.[1]) {
            uploadTracker.capturedStoragePath = decodeURIComponent(match[1]);
          }
          await route.continue();
          return;
        }
        await route.continue();
      });

      // 4. Localizar input mediante label accesible (H02: sin selectores CSS ni IDs frágiles)
      const dniFrontInput = page.getByLabel(/DNI frente/i);
      await expect(dniFrontInput).toBeAttached();

      // 5. Intentar la primera carga del frente del DNI durante el corte
      await dniFrontInput.setInputFiles({
        name: 'dni_front.png',
        mimeType: 'image/png',
        buffer: DUMMY_2X2_PNG,
      });

      // 6. H02: Verificar que la pantalla muestra el error con filtro de texto semántico
      const alert = page.getByRole('alert').filter({ hasText: /Error al subir|reintentar/i });
      await expect(alert).toBeVisible({ timeout: 15000 });
      expect(cutIntercepted).toBe(true);

      // 7. Restablecer la conectividad (desactivar el corte de red)
      simulatedCutActive = false;

      // 8. Reintentar la subida del documento usando el MISMO selector accesible
      await dniFrontInput.setInputFiles({
        name: 'dni_front.png',
        mimeType: 'image/png',
        buffer: DUMMY_2X2_PNG,
      });

      // 9. H02 / H10: Esperar el path con expect.poll sobre sessionStorage
      await expect.poll(async () => {
        const raw = await page.evaluate(() => sessionStorage.getItem('cadeapp_onboarding_docs'));
        if (!raw) return null;
        try {
          const parsed: unknown = JSON.parse(raw);
          if (
            typeof parsed === 'object' &&
            parsed !== null &&
            'dni_front' in parsed &&
            typeof (parsed as Record<string, unknown>).dni_front === 'string'
          ) {
            return (parsed as Record<string, string>).dni_front;
          }
        } catch {
          return null;
        }
        return null;
      }, {
        message: 'Timeout esperando que sessionStorage contenga el path de dni_front',
        timeout: 30000,
      }).not.toBeNull();

      // Validar sessionStorage sin any ni non-null assertions
      const rawDocs = await page.evaluate(() => sessionStorage.getItem('cadeapp_onboarding_docs'));
      if (!rawDocs) {
        throw new Error('[E2E Error] No se encontró cadeapp_onboarding_docs en sessionStorage tras la carga');
      }
      const parsedDocs: unknown = JSON.parse(rawDocs);
      if (
        typeof parsedDocs !== 'object' ||
        parsedDocs === null ||
        !('dni_front' in parsedDocs) ||
        typeof (parsedDocs as Record<string, unknown>).dni_front !== 'string'
      ) {
        throw new Error('[E2E Error] Estructura inválida de documentos en sessionStorage');
      }
      const storagePathFromSession = (parsedDocs as Record<string, string>).dni_front;
      expect(uploadTracker.capturedStoragePath).not.toBeNull();
      expect(storagePathFromSession).toBe(uploadTracker.capturedStoragePath);
      expect(storagePathFromSession).toMatch(/^courier\/[a-f0-9-]+\/dni_front_\d+\.(png|jpe?g|webp)$/i);

      // H02: Verificar role=status con el filename controlado por el test (dni_front.png)
      const statusElement = page.getByRole('status').filter({ hasText: 'dni_front.png' });
      await expect(statusElement).toBeVisible({ timeout: 10000 });
    } finally {
      // H06: Cleanup fail-safe con admin client en Storage
      const pathToClean = uploadTracker.capturedStoragePath;
      if (typeof pathToClean === 'string' && pathToClean.length > 0) {
        const admin = createAdminClient();
        const { error: removeError } = await admin.storage
          .from(COURIER_DOCS_BUCKET)
          .remove([pathToClean]);
        expect(removeError).toBeNull();

        const lastSlashIdx = pathToClean.lastIndexOf('/');
        const folder = lastSlashIdx !== -1 ? pathToClean.substring(0, lastSlashIdx) : '';
        const filename = lastSlashIdx !== -1 ? pathToClean.substring(lastSlashIdx + 1) : pathToClean;

        const { data: listData, error: listError } = await admin.storage
          .from(COURIER_DOCS_BUCKET)
          .list(folder, { search: filename });
        expect(listError).toBeNull();
        expect(listData?.find((item) => item.name === filename)).toBeUndefined();
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

    let uploadedPathToCleanup: string | null = null;
    try {
      // 1. Crear cliente autenticado como repartidor
      const courierClient = await createAuthenticatedClient(courier);

      // 2. Intentar subir al bucket privado 'courier-docs' un tipo de archivo no permitido (text/plain)
      const invalidFilePayload = Buffer.from('console.log("invalid file test payload");');
      const invalidStoragePath = `courier/${courier.id}/dni_front_${Date.now()}.txt`;
      uploadedPathToCleanup = invalidStoragePath;

      const { data, error } = await courierClient.storage
        .from(COURIER_DOCS_BUCKET)
        .upload(invalidStoragePath, invalidFilePayload, {
          contentType: 'text/plain',
          upsert: false,
        });

      // 3. H12: Rechazo específico de tipo MIME (sin fallback genérico)
      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/mime type .*not (allowed|supported)|mime type/i);
    } finally {
      if (uploadedPathToCleanup) {
        const admin = createAdminClient();
        await admin.storage.from(COURIER_DOCS_BUCKET).remove([uploadedPathToCleanup]);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // DoD 3: axe AA en login, crear solicitud, lista del repartidor, viaje y onboarding
  // H09: División en tests separados utilizando el fixture page nativo de Playwright
  // ---------------------------------------------------------------------------
  test('DoD: axe AA en login (sesión anónima)', async ({ page }) => {
    await page.goto('/login');
    await waitForNoSkeletons(page);
    await expect(page).toHaveURL(/\/login$/);
    const audit = await runAxeAudit(page, 'login (/login)');
    expect(
      audit.violations,
      `Violaciones WCAG en Login:\n${JSON.stringify(audit.violations, null, 2)}`
    ).toEqual([]);
    expect(audit.passes.length).toBeGreaterThan(0);
  });

  test('DoD: axe AA en crear solicitud (comercio)', async ({
    page,
    loginAsMerchant,
  }) => {
    const { merchantPage } = await loginAsMerchant(page);
    await merchantPage.gotoNewRequest();
    await waitForNoSkeletons(page);
    await expect(page).toHaveURL(/\/merchant\/requests\/new$/);
    const audit = await runAxeAudit(page, 'crear solicitud (/merchant/requests/new)');
    expect(
      audit.violations,
      `Violaciones WCAG en Crear Solicitud:\n${JSON.stringify(audit.violations, null, 2)}`
    ).toEqual([]);
    expect(audit.passes.length).toBeGreaterThan(0);
  });

  test('DoD: axe AA en feed, viaje y onboarding (repartidor)', async ({
    page,
    stagingContext,
    loginAsCourier,
  }) => {
    const { courierPage } = await loginAsCourier(0, page);

    // 1. Lista del repartidor (/courier/feed)
    await courierPage.gotoFeed();
    await waitForNoSkeletons(page);
    await expect(page).toHaveURL(/\/courier\/feed$/);
    const feedAudit = await runAxeAudit(page, 'lista del repartidor (/courier/feed)');
    expect(
      feedAudit.violations,
      `Violaciones WCAG en Lista del Repartidor:\n${JSON.stringify(feedAudit.violations, null, 2)}`
    ).toEqual([]);
    expect(feedAudit.passes.length).toBeGreaterThan(0);

    // 2. Pantalla operativa: viaje (/trips/:id)
    const courier = stagingContext.courierUsers?.[0];
    if (!courier) {
      throw new Error('[E2E Error] No se encontró courier en stagingContext');
    }
    const seededTrip = await seedDeliveryRequestInState(stagingContext, {
      status: 'matched',
      assignedCourierId: courier.id,
      withContacts: true,
    });
    await page.goto(`/trips/${seededTrip.requestId}`);
    await waitForNoSkeletons(page);
    await expect(page).toHaveURL(new RegExp(`/trips/${seededTrip.requestId}$`));
    const tripAudit = await runAxeAudit(page, `viaje (/trips/${seededTrip.requestId})`);
    expect(
      tripAudit.violations,
      `Violaciones WCAG en Viaje:\n${JSON.stringify(tripAudit.violations, null, 2)}`
    ).toEqual([]);
    expect(tripAudit.passes.length).toBeGreaterThan(0);

    // 3. Pantalla de incorporación: onboarding (/courier/onboarding/identity)
    await page.goto('/courier/onboarding/identity');
    await waitForNoSkeletons(page);
    await expect(page).toHaveURL(/\/courier\/onboarding\/identity$/);
    const onboardingAudit = await runAxeAudit(page, 'onboarding (/courier/onboarding/identity)');
    expect(
      onboardingAudit.violations,
      `Violaciones WCAG en Onboarding:\n${JSON.stringify(onboardingAudit.violations, null, 2)}`
    ).toEqual([]);
    expect(onboardingAudit.passes.length).toBeGreaterThan(0);
  });
});
