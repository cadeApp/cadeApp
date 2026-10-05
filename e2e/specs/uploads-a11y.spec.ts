import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import {
  test,
  expect,
  createAuthenticatedClient,
} from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { COURIER_DOCS_BUCKET } from '@/features/courier-onboarding/upload-manager';

/**
 * T-309: E2E de carga de documentos con red lenta y accesibilidad.
 *
 * DoD:
 * 1. Con red 3G simulada y un corte, la carga se completa al reintentar.
 * 2. El servidor rechaza un archivo inválido.
 * 3. axe AA en login, crear solicitud, lista del repartidor, viaje y onboarding.
 */

// Cargar el bundle minificado de axe-core desde node_modules
function loadAxeCoreSource(): string {
  const pnpmDir = path.join(process.cwd(), 'node_modules', '.pnpm');
  if (fs.existsSync(pnpmDir)) {
    const entries = fs.readdirSync(pnpmDir);
    const axeDir = entries.find((e) => e.startsWith('axe-core@'));
    if (axeDir) {
      const fullPath = path.join(pnpmDir, axeDir, 'node_modules', 'axe-core', 'axe.min.js');
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath, 'utf8');
      }
    }
  }

  const directPath = path.join(process.cwd(), 'node_modules', 'axe-core', 'axe.min.js');
  if (fs.existsSync(directPath)) {
    return fs.readFileSync(directPath, 'utf8');
  }

  throw new Error('[A11y Error] No se pudo localizar el bundle minificado de axe-core en node_modules');
}

const AXE_CORE_SOURCE = loadAxeCoreSource();

interface AxeViolationNode {
  html: string;
  target: string[];
  failureSummary?: string;
}

interface AxeViolation {
  id: string;
  impact?: string;
  description: string;
  help: string;
  helpUrl: string;
  nodes: AxeViolationNode[];
}

interface AxeAuditReport {
  violations: AxeViolation[];
  passesCount: number;
}

async function runAxeAudit(page: Page, contextDescription: string): Promise<AxeAuditReport> {
  const hasAxe = await page.evaluate(() => typeof (window as unknown as { axe?: unknown }).axe !== 'undefined');
  if (!hasAxe) {
    await page.evaluate(AXE_CORE_SOURCE);
  }

  const report = await page.evaluate(async (ctxDesc) => {
    // @ts-expect-error window.axe está inyectado en el runtime del navegador
    const raw = await window.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      },
    });

    return {
      context: ctxDesc,
      violations: raw.violations.map((v: {
        id: string;
        impact?: string;
        description: string;
        help: string;
        helpUrl: string;
        nodes: Array<{ html: string; target: string[]; failureSummary?: string }>;
      }) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        nodes: v.nodes.map((n) => ({
          html: n.html,
          target: n.target,
          failureSummary: n.failureSummary,
        })),
      })),
      passesCount: raw.passes.length,
    };
  }, contextDescription);

  return report;
}

// Buffer JPEG mínimo válido de 1x1 píxel para pruebas de subida
const DUMMY_1X1_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
);

test.describe('T-309 — E2E de carga de documentos con red lenta y accesibilidad', () => {
  // ---------------------------------------------------------------------------
  // DoD 1: Con red 3G simulada y un corte, la carga se completa al reintentar
  // ---------------------------------------------------------------------------
  test('DoD: Con red 3G simulada y un corte, la carga se completa al reintentar', async ({
    page,
    loginAsCourier,
  }) => {
    // 1. Iniciar sesión como repartidor y navegar al formulario de identidad del onboarding
    await loginAsCourier(0, page);
    await page.goto('/courier/onboarding/identity');
    await waitForNoSkeletons(page);

    // 2. Simular condiciones de red Slow 3G vía Chrome DevTools Protocol
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: ((500 * 1000) / 8) * 0.8, // 500 kbps
      uploadThroughput: ((500 * 1000) / 8) * 0.8,   // 500 kbps
      latency: 400,                                  // 400 ms RTT
    });

    // 3. Simular un corte transitorio de red ("un corte") interceptando la subida en Supabase Storage
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

    // 4. Intentar la primera carga del frente del DNI durante el corte
    const dniFrontInput = page.locator('#file-input-dni_front');
    await expect(dniFrontInput).toBeAttached();

    await dniFrontInput.setInputFiles({
      name: 'dni_front.jpg',
      mimeType: 'image/jpeg',
      buffer: DUMMY_1X1_JPEG,
    });

    // 5. Verificar que la tarjeta entra en estado de error y ofrece reintentar
    const dniFrontCard = page
      .locator('[data-slot="document-upload-card"]')
      .filter({ hasText: /DNI frente/i });

    await expect(dniFrontCard).toHaveAttribute('data-status', 'error', { timeout: 15000 });
    await expect(dniFrontCard.getByRole('alert')).toBeVisible();
    await expect(dniFrontCard.getByText(/Error al subir|reintentar/i)).toBeVisible();
    await expect(dniFrontCard.getByText(/^reintentar$/i)).toBeVisible();
    expect(cutIntercepted).toBe(true);

    // 6. Restablecer la conectividad (desactivar el corte de red)
    simulatedCutActive = false;

    // 7. Reintentar la subida del documento con la red 3G activa
    await dniFrontInput.setInputFiles({
      name: 'dni_front.jpg',
      mimeType: 'image/jpeg',
      buffer: DUMMY_1X1_JPEG,
    });

    // 8. Verificar que la carga se completa exitosamente tras el reintento
    await expect(dniFrontCard).toHaveAttribute('data-status', 'success', { timeout: 30000 });
    await expect(dniFrontCard.getByText(/cargado/i)).toBeVisible();
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
    page,
    loginPage,
    merchantPage,
    courierPage,
    tripPage,
    loginAsMerchant,
    loginAsCourier,
    stagingContext,
  }) => {
    // 1. Pantalla de acceso: login (/login)
    await loginPage.navigate();
    await waitForNoSkeletons(page);
    const loginAudit = await runAxeAudit(page, 'login (/login)');
    expect(
      loginAudit.violations,
      `Violaciones WCAG AA en Login:\n${JSON.stringify(loginAudit.violations, null, 2)}`
    ).toEqual([]);
    expect(loginAudit.passesCount).toBeGreaterThan(0);

    // 2. Pantalla de comercio: crear solicitud (/merchant/requests/new)
    await loginAsMerchant(page);
    await merchantPage.gotoNewRequest();
    await waitForNoSkeletons(page);
    const createReqAudit = await runAxeAudit(page, 'crear solicitud (/merchant/requests/new)');
    expect(
      createReqAudit.violations,
      `Violaciones WCAG AA en Crear Solicitud:\n${JSON.stringify(createReqAudit.violations, null, 2)}`
    ).toEqual([]);
    expect(createReqAudit.passesCount).toBeGreaterThan(0);

    // 3. Pantalla de repartidor: lista del repartidor (/courier/feed)
    await loginAsCourier(0, page);
    await courierPage.gotoFeed();
    await waitForNoSkeletons(page);
    const courierFeedAudit = await runAxeAudit(page, 'lista del repartidor (/courier/feed)');
    expect(
      courierFeedAudit.violations,
      `Violaciones WCAG AA en Lista del Repartidor:\n${JSON.stringify(courierFeedAudit.violations, null, 2)}`
    ).toEqual([]);
    expect(courierFeedAudit.passesCount).toBeGreaterThan(0);

    // 4. Pantalla operativa: viaje (/trips/:id)
    const requestId = stagingContext.createdRequestIds[0];
    if (!requestId) {
      throw new Error('[E2E Error] No se encontró requestId en stagingContext');
    }
    await tripPage.navigate(requestId);
    await waitForNoSkeletons(page);
    const tripAudit = await runAxeAudit(page, `viaje (/trips/${requestId})`);
    expect(
      tripAudit.violations,
      `Violaciones WCAG AA en Viaje:\n${JSON.stringify(tripAudit.violations, null, 2)}`
    ).toEqual([]);
    expect(tripAudit.passesCount).toBeGreaterThan(0);

    // 5. Pantalla de incorporación: onboarding (/courier/onboarding/identity)
    await page.goto('/courier/onboarding/identity');
    await waitForNoSkeletons(page);
    const onboardingAudit = await runAxeAudit(page, 'onboarding (/courier/onboarding/identity)');
    expect(
      onboardingAudit.violations,
      `Violaciones WCAG AA en Onboarding:\n${JSON.stringify(onboardingAudit.violations, null, 2)}`
    ).toEqual([]);
    expect(onboardingAudit.passesCount).toBeGreaterThan(0);
  });
});
