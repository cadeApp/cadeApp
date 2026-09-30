import type { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page Object para el panel del comercio (/merchant/dashboard y /requests).
 * Emplea selectores accesibles por rol y etiqueta.
 */
export class MerchantPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get newRequestButton(): Locator {
    return this.page.getByRole('button', { name: /nueva solicitud|pedir envío/i });
  }

  get requestsFeed(): Locator {
    return this.page.getByRole('region', { name: /solicitudes|mis envíos/i });
  }

  get destinationInput(): Locator {
    return this.page.getByLabel(/dirección de entrega|destino/i);
  }

  get recipientPhoneInput(): Locator {
    return this.page.getByLabel(/teléfono del destinatario|contacto/i);
  }

  async navigate(): Promise<void> {
    await this.goto('/merchant/dashboard');
  }
}
