import { test, expect, seedDeliveryRequestInState } from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { auditTrip, expectRealGoogleMap, logAriaHiddenFocusOrigin } from './trip-axe-shared.review';

// REVIEW ONLY / NEVER MERGE (T-350): auditoría axe AA real de R07 con mapa de Google cargado.
test('DoD temporal T-350: axe AA en viaje R07', async ({ page, stagingContext, loginAsCourier }) => {
  await loginAsCourier(0, page);
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
  await expectRealGoogleMap(page);
  await logAriaHiddenFocusOrigin(page, 'R07');
  await auditTrip(page);
});
