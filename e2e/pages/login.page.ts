import { expect, type Page, type Locator } from '@playwright/test';
import { authCopy } from '@/features/auth/copy';
import { waitForFormHydration } from '../helpers/hydration';
import { BasePage } from './base.page';

const isOutsideLogin = (url: URL): boolean =>
  url.pathname !== '/login' && !url.pathname.startsWith('/login/');

type LoginOutcome = 'navigated' | 'form-error' | 'pending';

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

  /**
   * Error que muestra el formulario. Se busca por texto: `getByRole('alert')` también encuentra el
   * `next-route-announcer` de Next.
   */
  get formError(): Locator {
    return this.page
      .getByText(authCopy.login.errorInvalidCredentials)
      .or(this.page.getByText(authCopy.login.errorGeneric));
  }

  async navigate(): Promise<void> {
    await this.goto('/login');
  }

  async login(email: string, password: string): Promise<void> {
    // T-337: antes de hidratar, el click hace un submit nativo y lo tipeado no llega al estado de React.
    await waitForFormHydration(this.submitButton);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await expect(this.emailInput).toHaveValue(email);
    await expect(this.passwordInput).toHaveValue(password);
    await this.submitButton.click();

    // Sale de /login o el formulario muestra su error: con error se falla ya, con su texto.
    const outcome = async (): Promise<LoginOutcome> => {
      if (isOutsideLogin(new URL(this.page.url()))) return 'navigated';
      return (await this.formError.isVisible()) ? 'form-error' : 'pending';
    };
    await expect
      .poll(outcome, {
        timeout: 30_000,
        message: 'El login no salió de /login ni mostró un error del formulario',
      })
      .not.toBe('pending');
    if ((await outcome()) === 'form-error') {
      const shown = await this.formError.first().innerText();
      throw new Error(`LoginPage.login: el formulario mostró «${shown}» y se quedó en /login`);
    }

    await this.page.waitForURL(isOutsideLogin, { timeout: 30000 });
    await this.waitForNoSkeletons();
  }
}
