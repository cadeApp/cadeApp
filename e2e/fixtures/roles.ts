import { test as baseTest, expect, type Page } from '@playwright/test';
import { MerchantPage, CourierPage, AdminPage, LoginPage, TripPage } from '../pages';
import {
  createStagingSeedContext,
  seedStagingData,
  cleanupStagingData,
  type StagingSeedContext,
  type UserCredentials,
} from './staging-seed';

export interface RoleFixtures {
  loginPage: LoginPage;
  merchantPage: MerchantPage;
  courierPage: CourierPage;
  tripPage: TripPage;
  adminPage: AdminPage;
  stagingContext: StagingSeedContext;
  loginAsMerchant: (pageInstance?: Page) => Promise<{ page: Page; merchantPage: MerchantPage; user: UserCredentials }>;
  loginAsCourier: (courierIndex?: number, pageInstance?: Page) => Promise<{ page: Page; courierPage: CourierPage; user: UserCredentials }>;
}

/**
 * Fixture de Playwright extendida con los Page Objects de cada rol y contexto de datos de staging.
 * Garantiza que cada prueba cuente con páginas tipadas, ejecute seed real de staging con usuarios
 * auténticos en memoria y garantice la limpieza automática en el teardown vía bloque finally.
 */
export const test = baseTest.extend<RoleFixtures>({
  stagingContext: async ({}, use) => {
    const context = createStagingSeedContext();
    let seedOrTestError: unknown = null;
    try {
      await seedStagingData(context, {
        requestsCount: 1,
        withMerchant: true,
        couriersCount: 2,
        withContacts: true,
        recipientPhone: '+5493865123456',
        createOffersForFirstRequest: true,
      });
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

  tripPage: async ({ page }, use) => {
    const tripPage = new TripPage(page);
    await use(tripPage);
  },

  adminPage: async ({ page }, use) => {
    const adminPage = new AdminPage(page);
    await use(adminPage);
  },

  loginAsMerchant: async ({ page, stagingContext }, use) => {
    const loginHelper = async (pageInstance?: Page) => {
      const p = pageInstance ?? page;
      const lp = new LoginPage(p);
      const mp = new MerchantPage(p);
      const merchant = stagingContext.merchantUser;
      if (!merchant) {
        throw new Error('[E2E Error] No merchant user seeded in stagingContext');
      }
      await lp.navigate();
      await lp.login(merchant.email, merchant.password);
      return { page: p, merchantPage: mp, user: merchant };
    };
    await use(loginHelper);
  },

  loginAsCourier: async ({ page, stagingContext }, use) => {
    const loginHelper = async (courierIndex = 0, pageInstance?: Page) => {
      const p = pageInstance ?? page;
      const lp = new LoginPage(p);
      const cp = new CourierPage(p);
      const courier = stagingContext.courierUsers?.[courierIndex];
      if (!courier) {
        throw new Error(`[E2E Error] Courier at index ${courierIndex} not found in stagingContext`);
      }
      await lp.navigate();
      await lp.login(courier.email, courier.password);
      return { page: p, courierPage: cp, user: courier };
    };
    await use(loginHelper);
  },
});

export { expect };
