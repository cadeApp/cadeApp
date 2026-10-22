import { randomUUID } from 'node:crypto';
import { type Page } from '@playwright/test';
import {
  test,
  expect,
  assertAllowedE2EEnvironment,
  seedAdminUser,
  createAuthenticatedClient,
  generateTotp,
  trackEntityForCleanup,
  type StagingSeedContext,
  type UserCredentials,
} from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { waitForFormHydration } from '../helpers/hydration';
import { LoginPage } from '../pages';
import { createAdminClient } from '@/server/supabase/admin';

/**
 * T-410 (CC-037): sección «Viajes» del admin.
 *
 * - Un viaje de 2 entregas con una no realizada aparece en «Con problemas» con su etiqueta, y su detalle muestra el
 *   motivo del repartidor.
 * - Un viaje entregado completo aparece en «Todos» y no en «Con problemas».
 * - El ciclo de cada viaje corre por las RPC reales: publicación del comercio, oferta, aceptación, retiro y entregas.
 */

const FAILED_REASON = 'El destinatario no responde';

function requestCode(id: string): string {
  return `REQ-${id.slice(0, 8).toUpperCase()}`;
}

/** Admin con un factor TOTP verificado (mismo patrón que `security-headers.spec.ts`). */
async function seedAdminWithTotp(context: StagingSeedContext): Promise<{
  credentials: UserCredentials;
  totpSecret: string;
}> {
  const credentials = await seedAdminUser(context);
  const client = await createAuthenticatedClient(credentials);
  const { data: enrolled, error: enrollErr } = await client.auth.mfa.enroll({ factorType: 'totp' });
  if (enrollErr || !enrolled?.totp?.secret) {
    throw new Error(`[E2E MFA Error] Error al enrolar TOTP: ${enrollErr?.message}`);
  }
  const { error: verifyErr } = await client.auth.mfa.challengeAndVerify({
    factorId: enrolled.id,
    code: generateTotp(enrolled.totp.secret),
  });
  if (verifyErr) {
    throw new Error(`[E2E MFA Error] Error al verificar TOTP inicial: ${verifyErr.message}`);
  }
  return { credentials, totpSecret: enrolled.totp.secret };
}

async function loginAdminWithMfa(page: Page, credentials: UserCredentials, totpSecret: string): Promise<void> {
  const loginPage = new LoginPage(page);
  await loginPage.navigate();
  await waitForFormHydration(loginPage.submitButton);
  await loginPage.emailInput.fill(credentials.email);
  await loginPage.passwordInput.fill(credentials.password);
  await loginPage.submitButton.click();
  await page.waitForURL(/\/login\/mfa/);

  const codeInput = page.getByLabel(/código de seguridad/i);
  await waitForFormHydration(codeInput);
  await codeInput.fill(generateTotp(totpSecret));
  await page.getByRole('button', { name: /verificar/i }).click();
  await page.waitForURL(/\/admin/);
}

/**
 * Borrador con `outcomes.length` entregas, publicado por el comercio y llevado por RPC hasta cerrar: cada entrega
 * termina entregada o no entregada según `outcomes`.
 */
async function runTrip(
  context: StagingSeedContext,
  outcomes: readonly ('delivered' | 'failed')[]
): Promise<string> {
  const merchant = context.merchantUser;
  const courier = context.courierUsers?.[0];
  if (!merchant || !courier) {
    throw new Error('[E2E Error] Se requieren merchant y courier en stagingContext');
  }

  const admin = createAdminClient();
  const requestId = randomUUID();
  const dropIds = outcomes.map(() => randomUUID());
  trackEntityForCleanup(context, 'request', requestId);

  const { data: zones } = await admin.from('zones').select('id').eq('active', true).limit(1);
  const zoneId = zones?.[0]?.id;
  if (!zoneId) throw new Error('[E2E Error] Se requiere al menos una zona activa');

  const { error: reqErr } = await admin.from('delivery_requests').insert({
    id: requestId,
    merchant_id: merchant.id,
    pickup_zone_id: zoneId,
    status: 'draft',
    drops_count: outcomes.length,
  });
  expect(reqErr).toBeNull();
  const { error: contactErr } = await admin
    .from('delivery_request_contacts')
    .insert({ request_id: requestId, pickup_address: 'Pellegrini y French' });
  expect(contactErr).toBeNull();
  const { error: dropsErr } = await admin.from('delivery_request_drops').insert(
    dropIds.map((id, index) => ({
      id,
      request_id: requestId,
      position: index + 1,
      dropoff_zone_id: zoneId,
      package_type: 'chico',
      recipient_payment_method: 'transfer',
      needs_change: false,
      status: 'pending',
    }))
  );
  expect(dropsErr).toBeNull();
  const { error: dropContactsErr } = await admin.from('delivery_request_drop_contacts').insert(
    dropIds.map((id, index) => ({
      drop_id: id,
      dropoff_address: `Calle ${index + 1}`,
      recipient_name: `Cliente ${index + 1}`,
      recipient_phone: `386510000${index}`,
      recipient_consent_declared: true,
    }))
  );
  expect(dropContactsErr).toBeNull();

  const merchantClient = await createAuthenticatedClient(merchant);
  const courierClient = await createAuthenticatedClient(courier);
  const { error: publishErr } = await merchantClient.rpc('publish_request', { p_request_id: requestId });
  expect(publishErr).toBeNull();
  const { data: offerData, error: offerErr } = await courierClient.rpc('submit_offer', {
    p_request_id: requestId,
    p_amount_ars: 1200,
    p_eta_minutes: 15,
    p_message: 'Oferta T-410',
  });
  expect(offerErr).toBeNull();
  const offerId = (offerData as { offerId: string } | null)?.offerId;
  if (!offerId) throw new Error('[E2E Error] submit_offer no devolvió offerId');
  trackEntityForCleanup(context, 'offer', offerId);
  const { error: acceptErr } = await merchantClient.rpc('accept_offer', { p_offer_id: offerId });
  expect(acceptErr).toBeNull();
  const { error: pickupErr } = await courierClient.rpc('mark_picked_up', { p_request_id: requestId });
  expect(pickupErr).toBeNull();

  for (const [index, outcome] of outcomes.entries()) {
    const dropId = dropIds[index];
    if (!dropId) throw new Error('[E2E Error] entrega sin id');
    if (outcome === 'delivered') {
      const { error } = await courierClient.rpc('mark_drop_delivered', { p_drop_id: dropId });
      expect(error).toBeNull();
    } else {
      const { error } = await courierClient.rpc('mark_drop_failed', { p_drop_id: dropId, p_reason: FAILED_REASON });
      expect(error).toBeNull();
    }
  }

  const { data: closed } = await admin.from('delivery_requests').select('status').eq('id', requestId).single();
  expect(closed?.status).toBe('delivered');
  return requestId;
}

test.describe('T-410 — Admin: sección Viajes', () => {
  test('un viaje con una entrega no realizada aparece en «Con problemas» y su detalle muestra el motivo', async ({
    page,
    stagingContext,
  }) => {
    assertAllowedE2EEnvironment();

    const partialId = await runTrip(stagingContext, ['delivered', 'failed']);
    const completeId = await runTrip(stagingContext, ['delivered']);
    const { credentials, totpSecret } = await seedAdminWithTotp(stagingContext);
    await loginAdminWithMfa(page, credentials, totpSecret);

    // La navegación tiene la sección.
    await page.getByRole('link', { name: 'Viajes', exact: true }).click();
    await page.waitForURL(/\/admin\/trips$/);
    await waitForNoSkeletons(page);

    // «Con problemas» (por defecto): el parcial con su etiqueta; el completo no.
    const partialRow = page.getByRole('listitem').filter({ hasText: requestCode(partialId) });
    await expect(partialRow.getByText('Entrega no realizada (1)')).toBeVisible();
    await expect(partialRow.getByText(/1 de 2 entregadas/)).toBeVisible();
    await expect(page.getByText(requestCode(completeId))).toHaveCount(0);

    // «Todos»: aparece el completo.
    await page.getByRole('link', { name: 'Todos' }).click();
    await page.waitForURL(/filter=all/);
    await waitForNoSkeletons(page);
    await expect(page.getByText(requestCode(completeId))).toBeVisible();

    // Detalle del parcial.
    await page.goto(`/admin/trips/${partialId}`);
    await waitForNoSkeletons(page);
    await expect(page.getByRole('heading', { level: 1, name: requestCode(partialId) })).toBeVisible();
    const failedDrop = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: /Entrega 2/ }) });
    await expect(failedDrop.getByText('No entregada')).toBeVisible();
    await expect(failedDrop.getByText(`Motivo: ${FAILED_REASON}`)).toBeVisible();
    await expect(page.getByText('Entrega 1 entregada')).toBeVisible();
    // Sin datos del destinatario.
    await expect(page.getByText('Cliente 1')).toHaveCount(0);
    await expect(page.getByText('Calle 2')).toHaveCount(0);
  });
});
