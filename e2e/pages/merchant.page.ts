import type { Page, Locator } from '@playwright/test';
import { formatArs } from '@/lib/format';
import { BasePage } from './base.page';

/**
 * Page Object para el panel del comercio (/merchant/dashboard y /requests).
 * Emplea selectores accesibles por rol y etiqueta.
 */
export class MerchantPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get newRequestButton(): Locator {
    return this.page.getByRole('button', { name: /nueva solicitud|pedir envío/i });
  }

  get requestsFeed(): Locator {
    return this.page.getByRole('region', { name: /solicitudes|mis envíos/i });
  }

  async navigate(): Promise<void> {
    await this.goto('/merchant/dashboard');
  }

  async gotoNewRequest(): Promise<void> {
    await this.goto('/merchant/requests/new');
  }

  async gotoRequestDetail(requestId: string): Promise<void> {
    await this.goto(`/merchant/requests/${requestId}`);
  }

  get pickupAddressInput(): Locator {
    return this.page.getByLabel(/dirección del comercio|dirección de retiro/i);
  }

  get dropoffAddressInput(): Locator {
    return this.page.getByLabel(/dirección de entrega|destino/i);
  }

  get recipientNameInput(): Locator {
    return this.page.getByLabel(/nombre de quien recibe|nombre del destinatario/i);
  }

  get recipientPhoneInput(): Locator {
    return this.page.getByLabel(/teléfono de contacto|teléfono del destinatario/i);
  }

  get consentCheckbox(): Locator {
    return this.page.getByLabel(/declaro que cuento con la autorización|declaro consentimiento/i);
  }

  get packageChicoButton(): Locator {
    return this.page.getByRole('button', { name: /^chico/i });
  }

  get paymentCashButton(): Locator {
    return this.page.getByRole('button', { name: /^efectivo$/i });
  }

  get paymentTransferButton(): Locator {
    return this.page.getByRole('button', { name: /^transferencia$/i });
  }

  get needsChangeYesButton(): Locator {
    return this.page.getByRole('button', { name: /^sí$/i });
  }

  get customChangeInput(): Locator {
    return this.page.getByPlaceholder(/otro monto en efectivo/i);
  }

  get notesInput(): Locator {
    return this.page.getByLabel(/indicaciones o referencias/i);
  }

  changePresetButton(amount: number): Locator {
    const formatted = formatArs(amount).replace('$', '\\$');
    return this.page.getByRole('button', { name: new RegExp(`paga con:?\\s*${formatted}`, 'i') });
  }

  get submitRequestButton(): Locator {
    return this.page.getByRole('button', { name: /publicar solicitud/i });
  }

  get docSortButton(): Locator {
    return this.page.getByRole('button', { name: /documentación/i });
  }

  get priceSortButton(): Locator {
    return this.page.getByRole('button', { name: /precio/i });
  }

  get acceptOfferButton(): Locator {
    return this.page.getByRole('button', { name: /^aceptar$/i });
  }

  get confirmAcceptButton(): Locator {
    return this.page.getByRole('button', { name: /sí, aceptar/i });
  }

  get alreadyMatchedAlert(): Locator {
    return this.page.getByRole('alert').filter({
      hasText: /ya fue asignada a otro repartidor|ALREADY_MATCHED/i,
    });
  }

  get offerCourierHeadings(): Locator {
    return this.page.getByRole('heading', { level: 4 });
  }
}
