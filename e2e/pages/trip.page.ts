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

  get deliveredStatus(): Locator {
    return this.page.getByText(/^entregado$/i);
  }

  get inTransitStatus(): Locator {
    return this.page.getByText(/^en camino$/i);
  }

  get assignedStatus(): Locator {
    return this.page.getByText(/^asignado$|^por retirar$/i);
  }
}
