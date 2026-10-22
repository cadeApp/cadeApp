import type { Browser, Page } from '@playwright/test';
import { test, expect, findRequestIdByNotesMarker, generateTotp, seedAdminUser, createAuthenticatedClient, elevateAdminToAal2 } from '../fixtures';
import type { StagingSeedContext, UserCredentials } from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { waitForFormHydration } from '../helpers/hydration';
import { createPilotGuard, createSupabasePilotStore, PILOT_BASELINE } from '../helpers/pilot';
import { LoginPage, type MerchantPage } from '../pages';
import { expirePublishedRequestForRefund, trackEntityForCleanup } from '@/server/e2e/staging-seed';
import { createAdminClient } from '@/server/supabase/admin';

/**
 * T-369 / CC-029 paso 3: E2E de créditos de publicación y planes (proyecto global-settings, serial).
 *
 * Cada prueba usa su propio comercio, repartidores y admin de la corrida y apaga `pilot_active`; los hooks lo
 * restauran al valor base aunque la prueba expire (T-375). El caso de piloto activo vive en
 * `publication-credits.spec.ts` (proyecto chromium, sin tocar settings).
 *   1. Sin créditos se bloquea; el admin AAL2 acredita por la UI; publicar reserva y aceptar una oferta consume.
 *   2. Una solicitud que vence devuelve el crédito reservado (reconciliación real de la base al leer el saldo).
 *   3. Plan ilimitado: el admin lo crea y registra por la UI y el comercio publica sin créditos.
 * Los saldos se leen en la UI y se confirman en la base (service role solo para verificar y preparar precondiciones).
 */

test.describe.configure({ mode: 'serial' });

type ChargeRow = { mode: string; cost: number; state: string; is_current: boolean };

const pilot = createPilotGuard(createSupabasePilotStore('E2E Credits Fail-Closed'), 'E2E Credits Fail-Closed');

/**
 * Corre `body` con el piloto en `active`. La restauración al valor base vive en los hooks (T-375), que Playwright
 * ejecuta también si la prueba expira; el `finally` es solo la primera línea de defensa.
 */
async function withPilot(active: boolean, body: () => Promise<void>): Promise<void> {
  try {
    await pilot.set(active);
    expect(await pilot.read()).toBe(active);
    await body();
  } finally {
    await pilot.restore();
    expect(await pilot.read()).toBe(PILOT_BASELINE);
  }
}

async function getCharges(requestId: string): Promise<ChargeRow[]> {
  const { data, error } = await createAdminClient()
    .from('publication_charges')
    .select('mode, cost, state, is_current')
    .eq('request_id', requestId);
  if (error) throw new Error(`[E2E Credits] No se pudieron leer los cargos: ${error.message}`);
  return (data ?? []) as ChargeRow[];
}

async function getBusinessName(merchantId: string): Promise<string> {
  const { data, error } = await createAdminClient()
    .from('merchants')
    .select('business_name, subscription_status, paid_until')
    .eq('profile_id', merchantId)
    .single();
  if (error || !data) throw new Error(`[E2E Credits] No se pudo leer el comercio: ${error?.message}`);
  // Precondición: sin abono legacy, para que con el piloto apagado el modo sea créditos o plan.
  expect(data.paid_until).toBeNull();
  return data.business_name;
}

async function publishFromForm(page: Page, merchantPage: MerchantPage, notesMarker: string): Promise<void> {
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
}

async function publishAndGetId(
  page: Page,
  merchantPage: MerchantPage,
  context: StagingSeedContext,
  notesMarker: string
): Promise<string> {
  await publishFromForm(page, merchantPage, notesMarker);
  await page.waitForURL((url) => !url.pathname.endsWith('/requests/new'), { timeout: 15_000 });
  return findRequestIdByNotesMarker(context, notesMarker);
}

/** Valor de una estadística (`dt`/`dd`) dentro de la región indicada. */
function stat(page: Page, regionName: string | RegExp, label: string) {
  return page
    .getByRole('region', { name: regionName })
    .getByRole('term')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator('xpath=following-sibling::dd[1]');
}

async function openMerchantPlan(page: Page) {
  await page.goto('/merchant/plan');
  await waitForNoSkeletons(page);
  return page.getByRole('region', { name: 'Mi plan' });
}

/** Admin de la corrida con TOTP propio, logueado por la UI en un contexto de navegador aparte (AAL2). */
async function openAdminSession(browser: Browser, context: StagingSeedContext): Promise<{ adminPage: Page; admin: UserCredentials }> {
  const admin = context.adminUser ?? (await seedAdminUser(context));
  const client = await createAuthenticatedClient(admin);
  const { data: enrolled, error: enrollErr } = await client.auth.mfa.enroll({ factorType: 'totp' });
  if (enrollErr || !enrolled?.totp?.secret) throw new Error(`[E2E MFA Error] Error al enrolar TOTP: ${enrollErr?.message}`);
  const secret = enrolled.totp.secret;
  const { error: verifyErr } = await client.auth.mfa.challengeAndVerify({ factorId: enrolled.id, code: generateTotp(secret) });
  if (verifyErr) throw new Error(`[E2E MFA Error] Error al verificar TOTP: ${verifyErr.message}`);

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  const login = new LoginPage(adminPage);
  await login.navigate();
  await waitForFormHydration(login.submitButton);
  await login.emailInput.fill(admin.email);
  await login.passwordInput.fill(admin.password);
  await login.submitButton.click();
  await adminPage.waitForURL(/\/login\/mfa/);
  await adminPage.getByLabel(/código de seguridad/i).fill(generateTotp(secret));
  await adminPage.getByRole('button', { name: /verificar/i }).click();
  await adminPage.waitForURL(/\/admin/);
  return { adminPage, admin };
}

async function grantLooseCreditsInUi(adminPage: Page, merchantId: string, credits: number): Promise<void> {
  await adminPage.goto(`/admin/merchants/${merchantId}/credits`);
  await waitForNoSkeletons(adminPage);
  await adminPage.getByRole('button', { name: 'Acreditar créditos' }).click();
  const dialog = adminPage.getByRole('dialog');
  await dialog.getByLabel('Cantidad de créditos').fill(String(credits));
  await dialog.getByLabel(/Ajuste administrativo/).check();
  await dialog.getByRole('button', { name: 'Continuar' }).click();
  await dialog.getByRole('button', { name: 'Confirmar' }).click();
  await expect(dialog.getByRole('status')).toContainText('Créditos acreditados.');
  await dialog.getByRole('button', { name: 'Cerrar' }).click();
}

test.describe('T-369 — créditos de publicación y planes (CC-029)', () => {
  test.beforeAll(async () => {
    await pilot.assertBaseline();
  });

  test.afterEach(async () => {
    await pilot.restore();
  });

  test.afterAll(async () => {
    await pilot.restore();
  });

  test('sin créditos se bloquea; el admin AAL2 acredita; publicar reserva y aceptar una oferta consume', async ({
    page,
    browser,
    merchantPage,
    stagingContext,
    loginAsMerchant,
  }) => {
    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    if (!merchant || !courier) throw new Error('[E2E Error] Faltan comercio o repartidor en stagingContext');
    const businessName = await getBusinessName(merchant.id);

    await withPilot(false, async () => {
      // Bloqueo sin saldo: la RPC rechaza y el formulario ofrece consultar créditos y planes.
      await loginAsMerchant(page);
      const blockedMarker = `E2E credits blocked ${stagingContext.testRunId}`;
      await publishFromForm(page, merchantPage, blockedMarker);
      await expect(page).toHaveURL(/\/merchant\/requests\/new/);
      const alert = page.getByRole('alert').filter({ hasText: /créditos suficientes para publicar/i });
      await expect(alert).toBeVisible();
      await expect(alert.getByRole('link', { name: 'Ver mis créditos y planes' })).toHaveAttribute('href', '/merchant/plan');
      const { data: blockedRows } = await createAdminClient()
        .from('delivery_requests')
        .select('id')
        .eq('merchant_id', merchant.id)
        .eq('notes', blockedMarker);
      expect(blockedRows ?? []).toHaveLength(0);
      const plan = await openMerchantPlan(page);
      await expect(plan.getByText('No tenés créditos disponibles')).toBeVisible();

      // Acreditación por la UI admin con AAL2: queda en el libro y en el saldo.
      const { adminPage } = await openAdminSession(browser, stagingContext);
      try {
        await grantLooseCreditsInUi(adminPage, merchant.id, 2);
        await adminPage.reload();
        await waitForNoSkeletons(adminPage);
        await expect(adminPage.getByRole('heading', { name: `Créditos de ${businessName}` })).toBeVisible();
        const ledger = adminPage.getByRole('table', { name: 'Movimientos de créditos' });
        await expect(ledger.getByRole('row').filter({ hasText: 'Alta' }).filter({ hasText: '2' })).toHaveCount(1);
      } finally {
        await adminPage.context().close();
      }

      await openMerchantPlan(page);
      await expect(stat(page, 'Mi plan', 'Créditos disponibles')).toHaveText('2');

      // Publicar reserva el costo (1 por una entrega).
      const requestId = await publishAndGetId(page, merchantPage, stagingContext, `E2E credits reserve ${stagingContext.testRunId}`);
      expect(await getCharges(requestId)).toEqual([{ mode: 'credits', cost: 1, state: 'reserved', is_current: true }]);
      await openMerchantPlan(page);
      await expect(stat(page, 'Mi plan', 'Créditos disponibles')).toHaveText('1');
      await expect(stat(page, 'Mi plan', 'Reservados en solicitudes')).toHaveText('1');

      // El repartidor oferta y el comercio acepta por la UI: la reserva se consume.
      const courierClient = await createAuthenticatedClient(courier);
      const { error: offerErr } = await courierClient.rpc('submit_offer', {
        p_request_id: requestId,
        p_amount_ars: 1500,
        p_eta_minutes: 15,
      });
      expect(offerErr).toBeNull();
      await merchantPage.gotoRequestDetail(requestId);
      await waitForNoSkeletons(page);
      await merchantPage.acceptOfferButton.first().click();
      await merchantPage.confirmAcceptButton.click();
      await expect
        .poll(async () => (await getCharges(requestId)).map((c) => c.state))
        .toEqual(['consumed']);
      await openMerchantPlan(page);
      await expect(stat(page, 'Mi plan', 'Créditos disponibles')).toHaveText('1');
      await expect(stat(page, 'Mi plan', 'Reservados en solicitudes')).toHaveText('0');
    });
  });

  test('si la solicitud vence, el crédito reservado vuelve al saldo', async ({
    page,
    merchantPage,
    stagingContext,
    loginAsMerchant,
  }) => {
    const merchant = stagingContext.merchantUser;
    if (!merchant) throw new Error('[E2E Error] No merchant user in stagingContext');
    await getBusinessName(merchant.id);

    await withPilot(false, async () => {
      // Precondición: un crédito suelto acreditado por la RPC admin con una sesión AAL2 real.
      const admin = await seedAdminUser(stagingContext);
      const adminClient = await createAuthenticatedClient(admin);
      await elevateAdminToAal2(adminClient, admin);
      const { error: grantErr } = await adminClient.rpc('admin_grant_publication_credits', {
        p_merchant_id: merchant.id,
        p_credits: 1,
        p_source: 'adjustment',
        p_operation_key: crypto.randomUUID(),
      });
      expect(grantErr).toBeNull();

      await loginAsMerchant(page);
      const requestId = await publishAndGetId(page, merchantPage, stagingContext, `E2E credits expire ${stagingContext.testRunId}`);
      expect(await getCharges(requestId)).toEqual([{ mode: 'credits', cost: 1, state: 'reserved', is_current: true }]);
      await openMerchantPlan(page);
      await expect(stat(page, 'Mi plan', 'Créditos disponibles')).toHaveText('0');

      await expirePublishedRequestForRefund(stagingContext, requestId);
      // Mi plan lee el saldo con get_my_publication_balance, que reconcilia la vencida y libera la reserva.
      await openMerchantPlan(page);
      await expect(stat(page, 'Mi plan', 'Créditos disponibles')).toHaveText('1');
      await expect(stat(page, 'Mi plan', 'Reservados en solicitudes')).toHaveText('0');
      expect(await getCharges(requestId)).toEqual([{ mode: 'credits', cost: 1, state: 'released', is_current: false }]);
      const { data: row } = await createAdminClient().from('delivery_requests').select('status').eq('id', requestId).single();
      expect(row?.status).toBe('expired');
    });
  });

  test('plan ilimitado: el admin lo crea y registra por la UI, y el comercio publica sin créditos', async ({
    page,
    browser,
    merchantPage,
    stagingContext,
    loginAsMerchant,
  }) => {
    const merchant = stagingContext.merchantUser;
    if (!merchant) throw new Error('[E2E Error] No merchant user in stagingContext');
    await getBusinessName(merchant.id);
    // CC-038: el admin solo escribe el nombre; la base deriva el código (minúsculas, guiones, hasta 32 caracteres).
    const runSlug = stagingContext.testRunId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const planName = `Ilimitado ${runSlug}`;
    const expectedCode = `ilimitado-${runSlug}`.slice(0, 32).replace(/-+$/, '');

    await withPilot(false, async () => {
      const { adminPage } = await openAdminSession(browser, stagingContext);
      try {
        await adminPage.goto('/admin/merchants/plans');
        await waitForNoSkeletons(adminPage);
        await adminPage.getByRole('button', { name: 'Nuevo plan' }).click();
        const planDialog = adminPage.getByRole('dialog');
        await planDialog.getByLabel('Nombre').fill(planName);
        await expect(planDialog.getByLabel('Código')).toHaveCount(0);
        await planDialog.getByLabel('Ilimitado').check();
        await planDialog.getByRole('button', { name: 'Guardar' }).click();
        await expect(planDialog).toBeHidden();
        const { data: planRow, error: planErr } = await createAdminClient()
          .from('publication_plans')
          .select('id, code, kind, monthly_credits, active')
          .eq('name', planName)
          .single();
        expect(planErr).toBeNull();
        if (!planRow) throw new Error('[E2E Credits] El plan no quedó creado');
        trackEntityForCleanup(stagingContext, 'publication_plan', planRow.id);
        expect(planRow).toMatchObject({ code: expectedCode, kind: 'unlimited', monthly_credits: null, active: true });

        await adminPage.goto(`/admin/merchants/${merchant.id}/credits`);
        await waitForNoSkeletons(adminPage);
        await adminPage.getByRole('button', { name: 'Registrar o renovar plan' }).click();
        const registerDialog = adminPage.getByRole('dialog');
        const option = registerDialog.getByLabel(new RegExp(`^${planName} · `));
        for (let attempt = 0; attempt < 10 && (await option.count()) === 0; attempt += 1) {
          const more = registerDialog.getByRole('button', { name: 'Ver más planes' });
          if ((await more.count()) === 0) break;
          await more.click();
          await expect(registerDialog.getByRole('button', { name: 'Cargando planes...' })).toHaveCount(0);
        }
        await option.check();
        await registerDialog.getByLabel('Cortesía (sin compra)').check();
        await registerDialog.getByRole('button', { name: 'Continuar' }).click();
        await registerDialog.getByRole('button', { name: 'Confirmar' }).click();
        await expect(registerDialog.getByRole('status')).toContainText('Plan registrado.');
      } finally {
        await adminPage.context().close();
      }

      await loginAsMerchant(page);
      const plan = await openMerchantPlan(page);
      await expect(plan.getByText('Tenés un plan ilimitado')).toBeVisible();
      await expect(stat(page, 'Mi plan', 'Créditos disponibles')).toHaveText('0');

      const requestId = await publishAndGetId(page, merchantPage, stagingContext, `E2E credits unlimited ${stagingContext.testRunId}`);
      expect(await getCharges(requestId)).toEqual([{ mode: 'unlimited', cost: 0, state: 'reserved', is_current: true }]);
      const { data: row } = await createAdminClient().from('delivery_requests').select('status').eq('id', requestId).single();
      expect(row?.status).toBe('published');
    });
  });
});
