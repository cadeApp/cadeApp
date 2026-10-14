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

  async navigate(): Promise<void> {
    await this.goto('/courier/dashboard');
  }

  async gotoFeed(): Promise<void> {
    await this.goto('/courier/feed');
  }

  async gotoOffers(): Promise<void> {
    await this.goto('/courier/offers');
  }

  get offerButton(): Locator {
    return this.page.getByRole('button', { name: /^ofertar$/i });
  }

  get offerAmountInput(): Locator {
    return this.page.getByLabel(/monto de la oferta|ofertar/i);
  }

  get submitOfferButton(): Locator {
    return this.page.getByRole('button', { name: /enviar oferta/i });
  }

  get offerErrorAlert(): Locator {
    return this.page.getByRole('alert');
  }

  get pendingTab(): Locator {
    return this.page.getByRole('button', { name: /pendientes/i });
  }

  get otherTab(): Locator {
    return this.page.getByRole('button', { name: /otras/i });
  }

  get acceptedTab(): Locator {
    return this.page.getByRole('button', { name: /aceptadas/i });
  }

  get withdrawOfferButton(): Locator {
    return this.page.getByRole('button', { name: /retirar oferta/i });
  }

  get confirmWithdrawButton(): Locator {
    return this.page.getByRole('button', { name: /sí, retirar oferta/i });
  }

  get minFloorText(): Locator {
    return this.page.getByText(/mínimo/i);
  }

  /**
   * Tarjeta del feed de una solicitud concreta. Se identifica por id porque el feed no muestra las
   * indicaciones antes del match (D3, T-342), así que no sirven como marcador.
   */
  requestCardById(requestId: string): Locator {
    return this.page.locator(`[data-testid="request-card"][data-request-id="${requestId}"]`);
  }
}
