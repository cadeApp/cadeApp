import { test as baseTest, expect } from '@playwright/test';
import { MerchantPage, CourierPage, AdminPage, LoginPage } from '../pages';
import {
  createStagingSeedContext,
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
 * Garantiza que cada prueba cuente con páginas tipadas y ejecute limpieza automática en el teardown.
 */
export const test = baseTest.extend<RoleFixtures>({
  stagingContext: async ({}, use) => {
    const context = createStagingSeedContext();
    await use(context);
    await cleanupStagingData(context);
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
