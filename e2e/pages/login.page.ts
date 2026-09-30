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

  get emailInput(): Locator {
    return this.page.getByLabel(/^email$/i);
  }

  get passwordInput(): Locator {
    return this.page.getByLabel(/^contraseña$/i);
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

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    await this.waitForNoSkeletons();
  }
}
