import type { Page } from '@playwright/test';
import { waitForNoSkeletons, type WaitForNoSkeletonsOptions } from '../helpers/skeletons';

/**
 * BasePage: abstracción base para todos los Page Objects de cadeApp en la suite E2E.
 * Centraliza la navegación, espera de carga y resolución de skeletons sin tiempos fijos.
 */
export class BasePage {
  constructor(protected readonly page: Page) {}

  /**
   * Navega a la ruta indicada y espera a que los skeletons de la pantalla desaparezcan.
   */
  async goto(path: string, options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<void> {
    await this.page.goto(path, options);
    await this.waitForNoSkeletons();
  }

  /**
   * Espera a que los bloques de carga Skeleton desaparezcan de la vista.
   */
  async waitForNoSkeletons(options?: WaitForNoSkeletonsOptions): Promise<void> {
    await waitForNoSkeletons(this.page, options);
  }

  /**
   * Retorna la URL actual de la página.
   */
  get currentUrl(): string {
    return typeof this.page.url === 'function' ? this.page.url() : '';
  }
}
