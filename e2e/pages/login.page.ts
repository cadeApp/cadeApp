import type { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page Object para la pantalla de inicio de sesión (/login).
 * Utiliza selectores accesibles por rol y label, prohibiendo selectores CSS frágiles (e2e/AGENTS.md).
 */
export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get phoneInput(): Locator {
    return this.page.getByLabel(/teléfono|celular|número de teléfono/i);
  }

  get passwordInput(): Locator {
    return this.page.getByLabel(/código|clave|contraseña/i);
  }

  get submitButton(): Locator {
    return this.page.getByRole('button', { name: /iniciar sesión|ingresar|continuar/i });
  }

  get registerLink(): Locator {
    return this.page.getByRole('link', { name: /registrarse|crear cuenta/i });
  }

  async navigate(): Promise<void> {
    await this.goto('/login');
  }

  async login(phone: string, passwordOrCode: string): Promise<void> {
    await this.phoneInput.fill(phone);
    await this.passwordInput.fill(passwordOrCode);
    await this.submitButton.click();
    await this.waitForNoSkeletons();
  }
}
