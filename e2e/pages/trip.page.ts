import type { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page Object para la vista de viaje (/trips/:id).
 * Emplea exclusivamente selectores accesibles (getByRole, getByLabel, getByText).
 */
export class TripPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate(tripId: string): Promise<void> {
    await this.goto(`/trips/${tripId}`);
  }

  get notifyCustomerLink(): Locator {
    return this.page.getByRole('link', { name: /avisar a mi cliente/i });
  }

  get markPickedUpButton(): Locator {
    return this.page.getByRole('button', { name: /marcar como retirado/i });
  }

  get confirmDeliveryButton(): Locator {
    return this.page.getByRole('button', { name: /confirmar entrega/i });
  }

  /**
   * Cabecera del viaje: código, título «Viaje en curso» y el badge con el estado
   * global del viaje. Las entregas (drops) tienen su propio badge de estado fuera
   * de esta cabecera, así que un drop entregado no cuenta como viaje entregado.
   */
  get tripHeader(): Locator {
    // T-379: el título es «Viaje en curso» mientras está activo y «Viaje finalizado» una vez entregado.
    return this.page
      .getByRole('heading', { level: 1, name: /^viaje (en curso|finalizado)$/i })
      .locator('xpath=../..');
  }

  get deliveredStatus(): Locator {
    return this.tripHeader.getByText(/^entregado$/i);
  }

  get inTransitStatus(): Locator {
    return this.page.getByText(/^en camino$/i);
  }

  get assignedStatus(): Locator {
    return this.page.getByText(/^asignado$|^por retirar$/i);
  }
}
