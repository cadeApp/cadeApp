import { test, expect, assertAllowedE2EEnvironment, createAuthenticatedClient, trackEntityForCleanup } from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { createAdminClient } from '@/server/supabase/admin';
import { COURIER_VEHICLES_COPY } from '@/features/courier-onboarding/copy';

/**
 * T-419 (CC-042): varios vehículos por repartidor y cambio rápido del activo.
 *
 * Un repartidor aprobado agrega una bici, la activa desde el feed y el comercio ve «bici» en su próxima oferta; al
 * volver a la moto, la patente sigue cargada.
 */
test.describe('T-419 — vehículos del repartidor', () => {
  test('agrega una bici, la activa desde el feed, el comercio la ve en la oferta y la moto conserva la patente', async ({
    page,
    stagingContext,
    loginAsCourier,
  }) => {
    assertAllowedE2EEnvironment();
    const courier = stagingContext.courierUsers?.[0];
    const merchant = stagingContext.merchantUser;
    const requestId = stagingContext.createdRequestIds[0];
    if (!courier || !merchant || !requestId) {
      throw new Error('[E2E Error] Se requieren courier, merchant y una solicitud en stagingContext');
    }

    const dbAdmin = createAdminClient();
    const { data: initial, error: initialError } = await dbAdmin
      .from('couriers')
      .select('vehicle_type, vehicle_plate')
      .eq('profile_id', courier.id)
      .single();
    expect(initialError).toBeNull();
    expect(initial?.vehicle_type).toBe('moto');
    const motoPlate = initial?.vehicle_plate ?? '';
    expect(motoPlate).not.toBe('');

    try {
      // 1. «Mis vehículos»: agrega la bici (sin patente) sin cambiar el activo.
      await loginAsCourier(0, page);
      await page.goto('/courier/onboarding/vehicle?mode=edit');
      await waitForNoSkeletons(page);
      await page.getByRole('radio', { name: COURIER_VEHICLES_COPY.types.bike }).click();
      await expect(page.locator('#new-vehicle-plate')).toHaveCount(0);
      await page.getByRole('button', { name: COURIER_VEHICLES_COPY.addButton }).click();
      await expect(page.getByTestId('courier-vehicle-bike')).toBeVisible();
      await expect(page.getByTestId('courier-vehicle-moto')).toContainText(COURIER_VEHICLES_COPY.activeBadge);

      // 2. Feed: el cambio rápido junto a «Disponible» activa la bici.
      await page.goto('/courier/feed');
      await waitForNoSkeletons(page);
      const quickSwitch = page.getByRole('radiogroup', { name: COURIER_VEHICLES_COPY.quickSwitchAria });
      const bikeOption = quickSwitch.getByRole('radio', { name: new RegExp(COURIER_VEHICLES_COPY.types.bike) });
      await bikeOption.click();
      await expect(bikeOption).toHaveAttribute('aria-checked', 'true');
      const { data: onBike } = await dbAdmin
        .from('couriers')
        .select('vehicle_type, vehicle_plate')
        .eq('profile_id', courier.id)
        .single();
      expect(onBike).toEqual({ vehicle_type: 'bike', vehicle_plate: null });

      // 3. La próxima oferta del repartidor llega al comercio con la bici.
      const courierClient = await createAuthenticatedClient(courier);
      const { data: offerData, error: offerError } = await courierClient.rpc('submit_offer', {
        p_request_id: requestId,
        p_amount_ars: 1500,
        p_eta_minutes: 15,
        p_message: 'Oferta T-419',
      });
      expect(offerError).toBeNull();
      const offerId = (offerData as { offerId: string } | null)?.offerId;
      if (!offerId) throw new Error('[E2E Error] submit_offer no devolvió offerId');
      trackEntityForCleanup(stagingContext, 'offer', offerId);

      const merchantClient = await createAuthenticatedClient(merchant);
      const { data: offerCouriers, error: offerCouriersError } = await merchantClient.rpc('get_request_offer_couriers', {
        p_request_id: requestId,
      });
      expect(offerCouriersError).toBeNull();
      const seen = (offerCouriers as { couriers: { courierId: string; vehicleType: string | null }[] }).couriers.find(
        (entry) => entry.courierId === courier.id
      );
      expect(seen?.vehicleType).toBe('bike');

      // 4. Con la oferta pendiente no se cambia de vehículo; retirada, vuelve a la moto con su patente.
      const { error: withdrawError } = await courierClient.rpc('withdraw_offer', { p_offer_id: offerId });
      expect(withdrawError).toBeNull();
      await page.reload();
      await waitForNoSkeletons(page);
      const motoOption = page
        .getByRole('radiogroup', { name: COURIER_VEHICLES_COPY.quickSwitchAria })
        .getByRole('radio', { name: new RegExp(COURIER_VEHICLES_COPY.types.moto) });
      await motoOption.click();
      await expect(motoOption).toHaveAttribute('aria-checked', 'true');
      const { data: backOnMoto } = await dbAdmin
        .from('couriers')
        .select('vehicle_type, vehicle_plate')
        .eq('profile_id', courier.id)
        .single();
      expect(backOnMoto).toEqual({ vehicle_type: 'moto', vehicle_plate: motoPlate });
    } finally {
      // La moto queda activa (paso 4): se borra la bici de esta prueba.
      await dbAdmin.from('courier_vehicles').delete().eq('courier_id', courier.id).eq('vehicle_type', 'bike');
    }
  });
});
