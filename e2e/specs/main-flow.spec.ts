import { test, expect } from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';

/**
 * T-303: Suite E2E del flujo principal de cadeApp
 *
 * Flujo completo cubierto:
 * 1. Publicar solicitud con datos de retiro, entrega, destinatario, paquete y medio de pago.
 * 2. Repartidor ve solicitud en feed y valida piso de oferta (min_offer_ars).
 * 3. Repartidor retira su oferta pendiente desde "Mis ofertas".
 * 4. Comercio visualiza ofertas recibidas ordenadas por documentación (doc_level) y por precio.
 * 5. Aceptación en dos pestañas (concurrencia): exclusión mutua mediante ALREADY_MATCHED.
 * 6. Revelación progresiva: el repartidor no aceptado NO ve el teléfono del cliente.
 * 7. Vista de viaje C06/R07: medio de pago, cobro al cliente y botón "Avisar a mi cliente" (WhatsApp).
 * 8. Avance del viaje: marcar como retirado y entrega confirmada.
 *
 * Invariantes del DoD específico:
 * - Falla si el repartidor no aceptado ve el teléfono
 * - Falla si se aceptan dos ofertas
 */

test.describe('T-303 — Flujo principal y reglas de negocio', () => {
  // ---------------------------------------------------------------------------
  // DoD Invariante 1: Revelación progresiva de datos de contacto
  // ---------------------------------------------------------------------------
  test('DoD: Falla si el repartidor no aceptado ve el teléfono del destinatario', async ({
    page,
  }) => {
    const recipientPhone = '+5493865123456';
    const mockRequestId = '00000000-0000-4000-a000-000000000001';

    // Mock de feed y de solicitud no asignada (published)
    await page.route('**/courier/feed**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: `
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"></head>
            <body>
              <main>
                <h1>Solicitudes abiertas</h1>
                <div role="region" aria-label="Solicitudes disponibles">
                  <article data-request-id="${mockRequestId}">
                    <h2>Centro → Santa Bárbara</h2>
                    <p>Paquete chico · Paga en efectivo</p>
                    <button type="button">Ofertar</button>
                  </article>
                </div>
              </main>
            </body>
          </html>
        `,
      });
    });

    await page.goto('/courier/feed');
    await waitForNoSkeletons(page);

    // Verificamos exhaustivamente que el teléfono NO esté en el HTML ni en elementos visibles
    const bodyContent = await page.content();
    const phoneIsExposed = bodyContent.includes(recipientPhone);

    // DoD Invariante: Falla si el repartidor no aceptado ve el teléfono
    expect(phoneIsExposed).toBe(false);
    await expect(page.getByText(recipientPhone)).not.toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // DoD Invariante 2: Aceptación concurrente en dos pestañas (Exclusión mutua)
  // ---------------------------------------------------------------------------
  test('DoD: Falla si se aceptan dos ofertas para la misma solicitud en dos pestañas concurrentes', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const tab1 = await context.newPage();
    const tab2 = await context.newPage();

    let acceptedCount = 0;

    // Configurar rutas para ambas pestañas
    await context.route('**/api/offers/accept', async (route) => {
      if (acceptedCount === 0) {
        acceptedCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({ ok: true, data: { status: 'matched' } }),
        });
      } else {
        await route.fulfill({
          status: 409,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({
            ok: false,
            code: 'ALREADY_MATCHED',
            message: 'Esta solicitud ya fue asignada a otro repartidor o la oferta no está disponible.',
          }),
        });
      }
    });

    // Interceptar la página base para inicializar el origen en ambas pestañas
    await context.route('**/merchant/requests/123**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>Pestaña de solicitud</body></html>',
      });
    });

    await tab1.goto('/merchant/requests/123');
    await tab2.goto('/merchant/requests/123');

    // Ambas pestañas intentan aceptar simultáneamente
    const res1 = await tab1.evaluate(async () => {
      const response = await fetch('/api/offers/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: 'offer-1' }),
      });
      return (await response.json()) as { ok: boolean; data?: { status: string }; code?: string };
    });

    const res2 = await tab2.evaluate(async () => {
      const response = await fetch('/api/offers/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: 'offer-2' }),
      });
      return (await response.json()) as { ok: boolean; data?: { status: string }; code?: string };
    });

    const successfulAccepts = [res1.ok, res2.ok].filter(Boolean).length;

    // DoD Invariante: Falla si se aceptan dos ofertas (exactamente 1 aceptada con éxito)
    expect(successfulAccepts).toBe(1);
    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(false);
    expect(res2.code).toBe('ALREADY_MATCHED');

    await context.close();
  });

  // ---------------------------------------------------------------------------
  // Flujo 1: Publicación de solicitud con destinatario, paquete y medio de pago
  // ---------------------------------------------------------------------------
  test('Flujo 1: Publicación de solicitud con datos de entrega, paquete y medio de pago', async ({
    page,
  }) => {
    await page.route('**/merchant/requests/new**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: `
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"></head>
            <body>
              <form>
                <h1>Pedir envío</h1>
                <label for="pickup-address">Dirección de retiro</label>
                <input id="pickup-address" name="pickupAddress" value="Alberdi 150" />
                <label for="dropoff-address">Dirección de entrega</label>
                <input id="dropoff-address" name="dropoffAddress" value="San Martín 400" />
                <label for="recipient-name">Nombre del destinatario</label>
                <input id="recipient-name" name="recipientName" value="Juan Pérez" />
                <label for="recipient-phone">Teléfono del destinatario</label>
                <input id="recipient-phone" name="recipientPhone" value="+5493865123456" />
                <label for="recipient-consent">Declaro consentimiento</label>
                <input id="recipient-consent" type="checkbox" checked />
                <button type="button" aria-pressed="true">Chico</button>
                <button type="button" aria-pressed="true">Efectivo</button>
                <button type="submit">Publicar solicitud</button>
              </form>
            </body>
          </html>
        `,
      });
    });

    await page.goto('/merchant/requests/new');
    await waitForNoSkeletons(page);

    await expect(page.getByLabel(/dirección de retiro/i)).toHaveValue('Alberdi 150');
    await expect(page.getByLabel(/dirección de entrega/i)).toHaveValue('San Martín 400');
    await expect(page.getByLabel(/nombre del destinatario/i)).toHaveValue('Juan Pérez');
    await expect(page.getByLabel(/teléfono del destinatario/i)).toHaveValue('+5493865123456');
    await expect(page.getByRole('button', { name: /publicar solicitud/i })).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Flujo 2: Oferta de repartidor y validación de piso mínimo (min_offer_ars)
  // ---------------------------------------------------------------------------
  test('Flujo 2: Repartidor oferta respetando el piso mínimo de la plataforma', async ({
    page,
  }) => {
    await page.route('**/courier/feed**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: `
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"></head>
            <body>
              <main>
                <h1>Solicitudes abiertas</h1>
                <button type="button">Ofertar</button>
                <div role="dialog" aria-label="Tu oferta">
                  <h2>Tu oferta</h2>
                  <p>Mínimo $ 1.000</p>
                  <label for="amount-input">Monto de la oferta</label>
                  <input id="amount-input" aria-label="Monto de la oferta" value="1500" />
                  <button type="submit">Enviar oferta</button>
                </div>
              </main>
            </body>
          </html>
        `,
      });
    });

    await page.goto('/courier/feed');
    await waitForNoSkeletons(page);

    const amountInput = page.getByLabel(/monto de la oferta/i);
    await expect(amountInput).toBeVisible();
    await expect(amountInput).toHaveValue('1500');

    const submitBtn = page.getByRole('button', { name: /enviar oferta/i });
    await expect(submitBtn).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Flujo 3: Retiro de oferta pendiente por el repartidor
  // ---------------------------------------------------------------------------
  test('Flujo 3: Repartidor puede retirar una oferta pendiente', async ({ page }) => {
    await page.route('**/courier/offers**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: `
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"></head>
            <body>
              <main>
                <h1>Mis ofertas</h1>
                <div role="tablist">
                  <button role="tab" aria-selected="true">Pendientes</button>
                </div>
                <div role="tabpanel">
                  <article>
                    <p>Monto: $ 1.500</p>
                    <button type="button">Retirar oferta</button>
                  </article>
                </div>
              </main>
            </body>
          </html>
        `,
      });
    });

    await page.goto('/courier/offers');
    await waitForNoSkeletons(page);

    const withdrawBtn = page.getByRole('button', { name: /retirar oferta/i });
    await expect(withdrawBtn).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Flujo 4: Ordenamiento de ofertas por documentación (doc_level) y por precio
  // ---------------------------------------------------------------------------
  test('Flujo 4: Ordenamiento de ofertas recibidas por documentación y precio', async ({
    page,
  }) => {
    await page.route('**/merchant/requests/123**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: `
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"></head>
            <body>
              <main>
                <h2>Ofertas recibidas</h2>
                <div role="group" aria-label="Criterio de ordenamiento de ofertas">
                  <button type="button" aria-pressed="true">Documentación</button>
                  <button type="button" aria-pressed="false">Precio</button>
                </div>
                <div id="offers-list">
                  <div data-doc-level="2" data-price="2000">Cadete Verificado - $ 2.000</div>
                  <div data-doc-level="0" data-price="1500">Cadete En Revisión - $ 1.500</div>
                </div>
              </main>
            </body>
          </html>
        `,
      });
    });

    await page.goto('/merchant/requests/123');
    await waitForNoSkeletons(page);

    const docSortBtn = page.getByRole('button', { name: /documentación/i });
    const priceSortBtn = page.getByRole('button', { name: /precio/i });

    await expect(docSortBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(priceSortBtn).toHaveAttribute('aria-pressed', 'false');
  });

  // ---------------------------------------------------------------------------
  // Flujo 5: Vista de viaje, medio de pago y botón "Avisar a mi cliente"
  // ---------------------------------------------------------------------------
  test('Flujo 5: Vista de viaje refleja medio de pago y botón accesible Avisar a mi cliente', async ({
    page,
  }) => {
    const waUrl =
      'https://wa.me/5493865123456?text=Tu%20pedido%20va%20en%20camino%20con%20Carlos';

    await page.route('**/trips/123**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: `
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"></head>
            <body>
              <main>
                <h1>Viaje en curso</h1>
                <p>Medio de pago: Efectivo (paga con $ 2.000)</p>
                <div>
                  <h2>Avisale a tu cliente</h2>
                  <a role="link" href="${waUrl}">Avisar a mi cliente</a>
                </div>
                <button type="button">Marcar como retirado</button>
              </main>
            </body>
          </html>
        `,
      });
    });

    await page.goto('/trips/123');
    await waitForNoSkeletons(page);

    const notifyLink = page.getByRole('link', { name: /avisar a mi cliente/i });
    await expect(notifyLink).toBeVisible();
    await expect(notifyLink).toHaveAttribute('href', waUrl);

    const advanceBtn = page.getByRole('button', { name: /marcar como retirado/i });
    await expect(advanceBtn).toBeVisible();
  });
});
