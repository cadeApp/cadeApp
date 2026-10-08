import { test, expect, seedDeliveryRequestInState } from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { auditTrip, expectRealGoogleMap, logAriaHiddenFocusOrigin } from './trip-axe-shared.review';

// REVIEW ONLY / NEVER MERGE (T-350): auditoría axe AA real de C06 con mapa de Google cargado.
test('DoD temporal T-350: axe AA en viaje C06', async ({ page, stagingContext, loginAsMerchant }) => {
  await loginAsMerchant(page);
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
  await expect(page.getByRole('heading', { name: 'Viaje en curso' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Repartidor asignado' })).toBeVisible();
  await expectRealGoogleMap(page);
  await logAriaHiddenFocusOrigin(page, 'C06');
  await auditTrip(page);
});
