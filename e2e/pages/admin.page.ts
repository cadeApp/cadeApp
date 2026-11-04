import { expect, type Page, type Locator } from '@playwright/test';
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

  /** T-402: botón «Menú» de la barra superior (solo debajo de `lg`). */
  get menuButton(): Locator {
    return this.page.getByRole('banner').getByRole('button', { name: 'Menú' });
  }

  /** T-402: la navegación del menú angosto, dentro del Sheet. */
  get menuNav(): Locator {
    return this.page
      .getByRole('dialog')
      .getByRole('navigation', { name: 'Navegación principal de administración' });
  }

  /** T-402: la navegación de la barra lateral (desde `lg`). */
  get sidebarNav(): Locator {
    return this.page
      .getByRole('complementary')
      .getByRole('navigation', { name: 'Navegación principal de administración' });
  }

  /**
   * T-402: abre el menú angosto. El botón no está en un formulario: se reintenta el clic hasta que React hidrata y
   * el Sheet se abre.
   */
  async openMenu(): Promise<void> {
    await expect(async () => {
      await this.menuButton.click();
      await expect(this.menuNav).toBeVisible({ timeout: 1_000 });
    }).toPass();
  }

  /** T-402: abre el menú angosto y entra a una sección por su nombre. */
  async goToSectionFromMenu(label: string): Promise<void> {
    await this.openMenu();
    await this.menuNav.getByRole('link', { name: label, exact: true }).click();
  }

  async navigate(): Promise<void> {
    await this.goto('/admin');
  }

  async navigateToSettings(): Promise<void> {
    await this.goto('/admin/settings');
  }
}
