import type { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page Object para el panel del repartidor (/courier/dashboard y /offers).
 * Emplea selectores accesibles por rol y etiqueta.
 */
export class CourierPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get availableRequestsFeed(): Locator {
    return this.page.getByRole('region', { name: /solicitudes disponibles|feed de pedidos/i });
  }

  get myOffersTab(): Locator {
    return this.page.getByRole('tab', { name: /mis ofertas/i });
  }

  get offerAmountInput(): Locator {
    return this.page.getByLabel(/monto de la oferta|ofertar/i);
  }

  get submitOfferButton(): Locator {
    return this.page.getByRole('button', { name: /enviar oferta|ofertar/i });
  }

  async navigate(): Promise<void> {
    await this.goto('/courier/dashboard');
  }
}
