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

  /** T-407: formulario de filtros de A06 (GET). */
  get auditFilters(): Locator {
    return this.page.getByRole('search', { name: 'Filtros de auditoría' });
  }

  /** T-407: completa «Desde» y «Hasta» (fechas civiles `YYYY-MM-DD`) y envía los filtros. */
  async filterAuditByDates(from: string, to: string): Promise<void> {
    await this.auditFilters.getByLabel('Desde').fill(from);
    await this.auditFilters.getByLabel('Hasta').fill(to);
    await this.auditFilters.getByRole('button', { name: 'Filtrar' }).click();
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

  /** T-403: buscador «Buscar por nombre» de la cola de postulantes. */
  get applicantsSearchInput(): Locator {
    return this.page.getByRole('searchbox', { name: 'Buscar por nombre' });
  }

  /** T-403: contador «N pendientes» junto al título de Postulantes. */
  get applicantsCount(): Locator {
    return this.page.getByTestId('applicants-count');
  }

  /** T-403: busca por nombre desde la UI; reintenta hasta que React hidrata y la URL lleva `q`. */
  async searchApplicants(term: string): Promise<void> {
    await expect(async () => {
      await this.applicantsSearchInput.fill(term);
      await this.page.getByRole('button', { name: 'Buscar' }).click();
      await expect(this.page).toHaveURL(/[?&]q=/, { timeout: 2_000 });
    }).toPass();
  }

  async navigate(): Promise<void> {
    await this.goto('/admin');
  }

  async navigateToSettings(): Promise<void> {
    await this.goto('/admin/settings');
  }
}
