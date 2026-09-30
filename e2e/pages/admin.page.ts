import type { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page Object para el panel de administración (/admin y /admin/settings).
 * Emplea selectores accesibles por rol y etiqueta.
 */
export class AdminPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get settingsLink(): Locator {
    return this.page.getByRole('link', { name: /configuración|parámetros de plataforma/i });
  }

  get minOfferInput(): Locator {
    return this.page.getByLabel(/oferta mínima|monto mínimo en ars/i);
  }

  get saveSettingsButton(): Locator {
    return this.page.getByRole('button', { name: /guardar cambios|actualizar configuración/i });
  }

  get auditLogTable(): Locator {
    return this.page.getByRole('table', { name: /registro de auditoría|audit log/i });
  }

  async navigate(): Promise<void> {
    await this.goto('/admin');
  }

  async navigateToSettings(): Promise<void> {
    await this.goto('/admin/settings');
  }
}
