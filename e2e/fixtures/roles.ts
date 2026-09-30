import { test as baseTest, expect } from '@playwright/test';
import { MerchantPage, CourierPage, AdminPage, LoginPage } from '../pages';
import {
  createStagingSeedContext,
  seedStagingData,
  cleanupStagingData,
  type StagingSeedContext,
} from './staging-seed';

export interface RoleFixtures {
  loginPage: LoginPage;
  merchantPage: MerchantPage;
  courierPage: CourierPage;
  adminPage: AdminPage;
  stagingContext: StagingSeedContext;
}

/**
 * Fixture de Playwright extendida con los Page Objects de cada rol y contexto de datos de staging.
 * Garantiza que cada prueba cuente con páginas tipadas, ejecute seed real de staging y
 * garantice la limpieza automática en el teardown vía bloque finally.
 */
export const test = baseTest.extend<RoleFixtures>({
  stagingContext: async ({}, use) => {
    const context = createStagingSeedContext();
    let seedOrTestError: unknown = null;
    try {
      await seedStagingData(context, { requestsCount: 1 });
      await use(context);
    } catch (err) {
      seedOrTestError = err;
      throw err;
    } finally {
      try {
        await cleanupStagingData(context);
      } catch (cleanupErr) {
        if (seedOrTestError) {
          const combined = new Error(
            `[E2E Lifecycle Error] Falló la ejecución principal y el cleanup posterior.\n` +
            `Error principal: ${seedOrTestError instanceof Error ? seedOrTestError.message : String(seedOrTestError)}\n` +
            `Error de cleanup: ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`
          );
          (combined as any).cause = seedOrTestError;
          throw combined;
        } else {
          throw cleanupErr;
        }
      }
    }
  },

  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  merchantPage: async ({ page }, use) => {
    const merchantPage = new MerchantPage(page);
    await use(merchantPage);
  },

  courierPage: async ({ page }, use) => {
    const courierPage = new CourierPage(page);
    await use(courierPage);
  },

  adminPage: async ({ page }, use) => {
    const adminPage = new AdminPage(page);
    await use(adminPage);
  },
});

export { expect };
