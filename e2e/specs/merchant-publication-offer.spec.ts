import { randomUUID } from 'node:crypto';
import { test, expect, assertAllowedE2EEnvironment, trackEntityForCleanup } from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { createAdminClient } from '@/server/supabase/admin';

/**
 * T-412 / CC-039: «Mi plan» muestra al comercio los planes activos con su precio de referencia (leídos con
 * `get_publication_offer`) y un botón para pedirlos por WhatsApp; un plan inactivo no aparece.
 */

test.describe('T-412 — Comercio: planes disponibles', () => {
  test('el comercio ve el plan activo con su precio y no ve el inactivo', async ({
    page,
    loginAsMerchant,
    stagingContext,
  }) => {
    assertAllowedE2EEnvironment();

    const suffix = randomUUID().slice(0, 8);
    const activeName = `E2E Plan ${suffix}`;
    const inactiveName = `E2E Inactivo ${suffix}`;
    const activeId = randomUUID();
    const inactiveId = randomUUID();

    // Fixture del catálogo: dos planes de la prueba, con códigos propios y orden 0 para quedar entre los primeros 50.
    const { error } = await createAdminClient()
      .from('publication_plans')
      .insert([
        {
          id: activeId,
          code: `e2e-plan-${suffix}`,
          name: activeName,
          kind: 'quota',
          monthly_credits: 12,
          reference_price_ars: 12345,
          active: true,
          sort: 0,
        },
        {
          id: inactiveId,
          code: `e2e-inactivo-${suffix}`,
          name: inactiveName,
          kind: 'quota',
          monthly_credits: 3,
          reference_price_ars: 999,
          active: false,
          sort: 0,
        },
      ]);
    expect(error).toBeNull();
    trackEntityForCleanup(stagingContext, 'publication_plan', activeId);
    trackEntityForCleanup(stagingContext, 'publication_plan', inactiveId);

    await loginAsMerchant(page);
    await page.goto('/merchant/plan');
    await waitForNoSkeletons(page);

    const section = page.getByRole('region', { name: 'Planes disponibles' });
    await expect(section).toBeVisible();
    const option = section.getByRole('listitem').filter({ hasText: activeName });
    await expect(option).toBeVisible();
    await expect(option.getByText('12 créditos por mes')).toBeVisible();
    await expect(option.getByText('$ 12.345 por mes')).toBeVisible();
    await expect(section.getByText(inactiveName)).toHaveCount(0);

    // Con número de soporte configurado es un enlace a wa.me con el plan; sin él, un botón deshabilitado.
    const action = option.getByLabel(`Quiero este plan: ${activeName}`);
    await expect(action).toBeVisible();
    const href = await action.getAttribute('href');
    if (href === null) {
      await expect(action).toBeDisabled();
    } else {
      expect(href).toContain('https://wa.me/549');
      expect(decodeURIComponent(href)).toContain(`quiero contratar el plan «${activeName}»`);
    }
  });
});
