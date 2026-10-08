// REVIEW ONLY / NEVER MERGE — E2E provisional de T-351 (ficha docs/tasks/T-351.md, «E2E provisional»).
// Solo existe en la rama review/T-351-onboarding-axe. No importa nada desde otros *.spec.ts.
import type { Page, Route } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { test, expect } from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { createAdminClient } from '@/server/supabase/admin';
import { COURIER_DOCS_BUCKET } from '@/features/courier-onboarding/upload-manager';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];

// PNG real 2x2, el mismo que usa T-309.
const DUMMY_2X2_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8//8/AwMDEwMDAwMDAwAkBgMB/DXemwAAAABJRU5ErkJggg==',
  'base64'
);

async function expectNoAxeViolations(page: Page, snapshot: string) {
  const audit = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(audit.violations, `Violaciones WCAG en ${snapshot}:\n${JSON.stringify(audit.violations, null, 2)}`).toEqual(
    []
  );
  expect(audit.passes.length).toBeGreaterThan(0);
}

test.describe('T-351 — REVIEW ONLY: axe AA en onboarding con tarjetas de documentos', () => {
  test('DoD temporal T-351: axe AA en onboarding con tarjetas de documentos', async ({ page, loginAsCourier }) => {
    let capturedStoragePath: string | null = null;
    let mode: 'hold' | 'abort' | 'continue' = 'hold';
    let heldRoute: Route | null = null;

    try {
      await loginAsCourier(0, page);
      await page.goto('/courier/onboarding/identity');
      await waitForNoSkeletons(page);
      await expect(page).toHaveURL(/\/courier\/onboarding\/identity$/);

      // Precondición semántica (PR306-H02): exactamente cuatro documentos.
      for (const name of [/DNI frente/i, /DNI dorso/i, /Selfie de validación/i, /Foto de perfil/i]) {
        await expect(page.getByLabel(name)).toBeAttached();
      }
      await expect(page.getByText('Subir', { exact: true })).toHaveCount(4);

      // 1. idle
      await expectNoAxeViolations(page, 'idle');

      await page.route('**/storage/v1/object/**', async (route) => {
        if (route.request().method() !== 'POST') {
          await route.continue();
          return;
        }
        if (mode === 'hold') {
          heldRoute = route;
          return;
        }
        if (mode === 'abort') {
          await route.abort('failed');
          return;
        }
        const match = route
          .request()
          .url()
          .match(/\/storage\/v1\/object\/courier-docs\/(.+?)(\?.*)?$/);
        if (match?.[1]) {
          capturedStoragePath = decodeURIComponent(match[1]);
        }
        await route.continue();
      });

      const dniFrontInput = page.getByLabel(/DNI frente/i);
      await expect(dniFrontInput).toBeAttached();

      // 2. uploading: el POST de Storage queda retenido mientras se audita.
      await dniFrontInput.setInputFiles({ name: 'dni_front.png', mimeType: 'image/png', buffer: DUMMY_2X2_PNG });
      await expect(page.getByRole('status').filter({ hasText: /Subiendo/i })).toBeVisible({ timeout: 15000 });
      await expect.poll(() => heldRoute !== null).toBe(true);
      await expectNoAxeViolations(page, 'uploading');

      // 3. error: se aborta el POST retenido, como el corte de red de T-309.
      mode = 'abort';
      const pending = heldRoute as Route | null;
      heldRoute = null;
      await pending?.abort('failed');
      await expect(page.getByRole('alert').filter({ hasText: /Error al subir|reintentar/i })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText('Reintentar', { exact: true })).toBeVisible();
      await expectNoAxeViolations(page, 'error');

      // 4. success: reintento con la red restablecida.
      mode = 'continue';
      await dniFrontInput.setInputFiles({ name: 'dni_front.png', mimeType: 'image/png', buffer: DUMMY_2X2_PNG });
      await expect(page.getByRole('status').filter({ hasText: 'dni_front.png' })).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('Cargado', { exact: true })).toBeVisible();
      expect(capturedStoragePath).not.toBeNull();
      await expectNoAxeViolations(page, 'success');
    } finally {
      // Cleanup con el patrón de T-309: borrar el objeto y confirmar que ya no existe.
      const pathToClean = capturedStoragePath as string | null;
      if (typeof pathToClean === 'string' && pathToClean.length > 0) {
        const admin = createAdminClient();
        const { error: removeError } = await admin.storage.from(COURIER_DOCS_BUCKET).remove([pathToClean]);
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
});
