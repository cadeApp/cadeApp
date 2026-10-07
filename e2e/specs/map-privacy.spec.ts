import { type Page } from '@playwright/test';
import {
  test,
  expect,
  seedOffersForFirstRequest,
  getRequestInspectionData,
  createAuthenticatedClient,
} from '../fixtures';
import { waitForNoSkeletons } from '../helpers/skeletons';
import { AGUILARES_BOUNDS } from '@/domain/schemas';

/**
 * T-314: E2E de mapas, geolocalización, privacidad (D3/D15) y degradación graceful (mock Google Maps).
 *
 * DoD:
 * 1. Playwright mockea Maps API (0 llamadas a Google).
 * 2. Valida que el feed abierto no tenga tags con coordenadas (D3/D15: DOM + red/RSC).
 * 3. Valida selección de pin en alta y solicitud.
 * 4. Valida error inline con pin fuera de Aguilares.
 * 5. Valida que tras matched aparezca el mapa y botón Google Maps.
 * 6. Valida degradación cuando Maps falla.
 */

const SENTINEL_COORDINATES = ['-27.432', '-65.612', '-27.435', '-65.615'] as const;

const GOOGLE_MAPS_DOMAINS_REGEX = /(maps\.googleapis\.com|maps\.google\.com|maps\.gstatic\.com)/i;

export interface GoogleMapsMockController {
  interceptedUrls: string[];
  unexpectedGoogleUrls: string[];
}

/**
 * Configura la intercepción estricta fail-closed de Google Maps API en Playwright (0 llamadas reales a Google).
 */
async function setupGoogleMapsMock(
  page: Page,
  options: { failApi?: boolean; simulatedUnexpectedHost?: string } = {}
): Promise<GoogleMapsMockController> {
  const interceptedUrls: string[] = [];
  const unexpectedGoogleUrls: string[] = [];

  await page.route(GOOGLE_MAPS_DOMAINS_REGEX, async (route) => {
    const url = route.request().url();
    let hostname = '';
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      // Ignorar URLs malformadas
    }

    const isExpectedHost =
      hostname === 'maps.googleapis.com' ||
      hostname === 'maps.gstatic.com' ||
      hostname === 'maps.google.com';

    if (
      !isExpectedHost ||
      (options.simulatedUnexpectedHost && url.includes(options.simulatedUnexpectedHost))
    ) {
      unexpectedGoogleUrls.push(url);
      await route.abort('failed');
      return;
    }

    interceptedUrls.push(url);

    if (options.failApi) {
      await route.abort('failed');
      return;
    }

    if (url.includes('/maps/api/js')) {
      const mockScript = `
        window.google = window.google || {};
        window.google.maps = window.google.maps || {
          Map: function(element, opts) {
            this._center = opts?.center || opts?.defaultCenter || { lat: -27.4333, lng: -65.6167 };
            this.setCenter = function(c) { this._center = c; };
            this.getCenter = function() {
              const center = this._center;
              return {
                lat: function() { return typeof center.lat === 'function' ? center.lat() : center.lat; },
                lng: function() { return typeof center.lng === 'function' ? center.lng() : center.lng; }
              };
            };
            this.panTo = function(c) { this._center = c; };
            this.setZoom = function() {};
            this.addListener = function() { return { remove: function() {} }; };
          },
          Marker: function(opts) {
            this._pos = opts?.position;
            this.setPosition = function(p) { this._pos = p; };
            this.getPosition = function() { return this._pos; };
            this.setMap = function() {};
            this.addListener = function() { return { remove: function() {} }; };
          },
          Polyline: function() {
            this.setPath = function() {};
            this.setMap = function() {};
          },
          LatLng: function(lat, lng) {
            return {
              lat: function() { return lat; },
              lng: function() { return lng; }
            };
          },
          event: {
            addListener: function() { return { remove: function() {} }; },
            removeListener: function() {},
            trigger: function() {},
          },
          importLibrary: function() {
            return Promise.resolve(window.google.maps);
          }
        };
      `;
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: mockScript,
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'OK', results: [] }),
    });
  });

  return {
    interceptedUrls,
    unexpectedGoogleUrls,
  };
}

test.describe('T-314 — E2E de mapas, geolocalización, privacidad y degradación graceful', () => {
  // ---------------------------------------------------------------------------
  // 1. Privacidad D3/D15: feed abierto sin tags ni coordenadas en DOM ni red/RSC (PR298-D01=A / H01)
  // ---------------------------------------------------------------------------
  test('DoD: el feed abierto del repartidor no tiene tags ni atributos con coordenadas (DOM y red/RSC)', async ({
    page,
    courierPage,
    stagingContext,
    loginAsCourier,
  }) => {
    await setupGoogleMapsMock(page);

    const requestId = stagingContext.createdRequestIds[0];
    if (!requestId) {
      throw new Error('[E2E Precondition Error] Se requiere una solicitud sembrada en stagingContext');
    }

    // Colector de respuestas textuales/JSON/RSC para detectar fugas de red de centinelas del seed (H01)
    const leakedResponses: Array<{ url: string; sentinel: string }> = [];
    const pendingResponseReads: Promise<void>[] = [];

    page.on('response', (response) => {
      const resourceType = response.request().resourceType();
      if (resourceType !== 'document' && resourceType !== 'fetch' && resourceType !== 'xhr') {
        return;
      }

      const url = response.url();
      if (GOOGLE_MAPS_DOMAINS_REGEX.test(url)) {
        return;
      }

      const contentType = (response.headers()['content-type'] ?? '').toLowerCase();
      const isTextual =
        contentType.includes('application/json') ||
        contentType.includes('text/html') ||
        contentType.includes('text/plain') ||
        contentType.includes('text/x-component') ||
        contentType.includes('application/x-component');

      if (!isTextual) {
        return;
      }

      pendingResponseReads.push(
        response
          .text()
          .then((body) => {
            for (const sentinel of SENTINEL_COORDINATES) {
              if (body.includes(sentinel)) {
                leakedResponses.push({ url, sentinel });
              }
            }
          })
          .catch(() => {
            // Respuestas canceladas antes del cierre
          })
      );
    });

    await loginAsCourier(0, page);

    // Espera explícita y obligatoria del fetch vivo que refresca el feed (H01)
    const liveFeedResponsePromise = page.waitForResponse((response) => {
      let pathname = '';
      try {
        pathname = new URL(response.url()).pathname;
      } catch {
        return false;
      }
      return (
        pathname === '/api/live/available-requests' &&
        ['fetch', 'xhr'].includes(response.request().resourceType())
      );
    });

    await page.goto('/courier/feed');
    await waitForNoSkeletons(page);

    const card = courierPage.requestCardById(requestId);
    await expect(card).toBeVisible();

    // Exigir positivamente que el endpoint vivo fue observado y responder con 200 (H01)
    const liveFeedResponse = await liveFeedResponsePromise;
    expect(liveFeedResponse.status()).toBe(200);

    const liveFeedBody = await liveFeedResponse.text();
    for (const sentinel of SENTINEL_COORDINATES) {
      expect(
        liveFeedBody,
        `fuga en endpoint vivo ${liveFeedResponse.url()}: centinela ${sentinel}`
      ).not.toContain(sentinel);
    }

    // Comprobar ausencia total de centinelas en las cargas de red y RSC (H01)
    await Promise.all(pendingResponseReads);
    expect(leakedResponses).toEqual([]);

    // 1. Verificación en el DOM de tarjetas: cero atributos con coordenadas
    const coordinateAttributes = ['data-lat', 'data-lng', 'data-coordinates', 'data-coords'];
    for (const attr of coordinateAttributes) {
      const elementsWithAttr = page.locator(`[${attr}]`);
      await expect(elementsWithAttr).toHaveCount(0);
    }

    // 2. Ningún elemento de mapa montado en el feed abierto
    await expect(page.locator('[data-testid="map-picker"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="trip-route-map"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="map-container"]')).toHaveCount(0);

    // 3. Verificación de texto: ningún patrón de coordenadas numéricas de Aguilares (-27.xxx, -65.xxx)
    const bodyText = await page.locator('body').innerText();
    const aguilaresCoordPattern = /-27\.\d{3,}|-65\.\d{3,}/;
    expect(bodyText).not.toMatch(aguilaresCoordPattern);

    // 4. Solo zonas nominales presentes en la tarjeta
    await expect(card.getByText(/→/)).toBeVisible();
    await expect(card.getByText(/km/i)).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // 2. Selección de pin en alta de comercio y error inline fuera de Aguilares (H02)
  // ---------------------------------------------------------------------------
  test('DoD: selección de pin en alta de comercio valida límites y muestra error inline fuera de Aguilares', async ({
    page,
    stagingContext,
  }) => {
    await setupGoogleMapsMock(page);

    await page.goto('/merchant/onboarding');
    await waitForNoSkeletons(page);

    const mapPicker = page.locator('[data-testid="map-picker"]');
    await expect(mapPicker).toBeVisible();

    const mapContainer = page.locator('[data-testid="map-container"]');
    await expect(mapContainer).toBeVisible();

    const outsideAlert = page.getByRole('alert').filter({
      hasText: /ubicación fuera de aguilares/i,
    });
    await expect(outsideAlert).toHaveCount(0);

    // Mover el pin suficientes pasos con el teclado hasta cruzar minLat (-27.4800) desde el centro (-27.4333) (H02)
    await mapContainer.focus();
    for (let i = 0; i < 500; i++) {
      await page.keyboard.press('ArrowDown');
    }

    // Exigir obligatoriamente la alerta accesible fuera de Aguilares generada por el pin (H02)
    await expect(outsideAlert).toBeVisible();

    // Mover el pin de regreso dentro de los límites
    for (let i = 0; i < 500; i++) {
      await page.keyboard.press('ArrowUp');
    }
    await expect(outsideAlert).toHaveCount(0);

    // Validación complementaria vía GPS/geolocalización simulada fuera de radio (sin condicionales)
    await page.context().setGeolocation({
      latitude: AGUILARES_BOUNDS.minLat - 0.05,
      longitude: AGUILARES_BOUNDS.minLng - 0.05,
    });
    await page.context().grantPermissions(['geolocation']);

    const useMyLocationBtn = page.getByRole('button', { name: /usar mi ubicación/i });
    await expect(useMyLocationBtn).toBeVisible();
    await useMyLocationBtn.click();
    await expect(outsideAlert).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // 3. Selección de pin en creación de solicitud y error inline fuera de rango (H02)
  // ---------------------------------------------------------------------------
  test('DoD: selección de pin en solicitud muestra mapa y valida error inline fuera de Aguilares', async ({
    page,
    merchantPage,
    stagingContext,
    loginAsMerchant,
  }) => {
    await setupGoogleMapsMock(page);

    await loginAsMerchant(page);
    await merchantPage.gotoNewRequest();
    await waitForNoSkeletons(page);

    // Desplegar mapa interactivo mediante el botón accesible obligatorio (H02)
    const openMapBtn = page.getByRole('button', { name: /fijar en mapa interactivo/i });
    await expect(openMapBtn).toBeVisible();
    await openMapBtn.click();

    const mapPicker = page.locator('[data-testid="map-picker"]');
    await expect(mapPicker).toBeVisible();

    const mapContainer = page.locator('[data-testid="map-container"]');
    await expect(mapContainer).toBeVisible();

    // Interactuar con el mapa con teclas para seleccionar un punto dentro de rango
    await mapContainer.focus();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowRight');

    // Comprobar indicador accesible de pin fijado
    await expect(page.getByText(/pin fijado/i)).toBeVisible();

    // Mover el pin suficientes pasos con el teclado hasta cruzar fuera del límite de Aguilares (H02)
    for (let i = 0; i < 500; i++) {
      await page.keyboard.press('ArrowDown');
    }

    const outsideAlert = page.getByRole('alert').filter({
      hasText: /fuera de aguilares/i,
    });
    await expect(outsideAlert).toBeVisible();

    // Validación complementaria vía GPS fuera de radio (sin condicionales y con locator unívoco de entrega) (H02)
    await page.context().setGeolocation({
      latitude: -27.5500,
      longitude: -65.7000,
    });
    await page.context().grantPermissions(['geolocation']);

    // Verificar que existen exactamente 2 botones "Usar mi ubicación" (retiro y entrega) en el formulario
    const allLocationButtons = page.getByRole('button', { name: /^usar mi ubicación$/i });
    await expect(allLocationButtons).toHaveCount(2);

    // Acotar de forma estable y semántica al bloque de destino y entrega (H02)
    const dropoffSection = page
      .locator('div')
      .filter({ has: page.getByRole('heading', { name: /destino y entrega/i }) })
      .first();
    const useDropoffGpsBtn = dropoffSection.getByRole('button', { name: /^usar mi ubicación$/i });
    await expect(useDropoffGpsBtn).toBeVisible();
    await useDropoffGpsBtn.click();
    await expect(
      page.getByText(/la ubicación está fuera del radio urbano de aguilares|fuera de aguilares/i)
    ).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // 4. Tras matched aparece el mapa y el botón "Abrir en Google Maps" (H03)
  // ---------------------------------------------------------------------------
  test('DoD: tras matched aparece el mapa de recorrido y botón Google Maps en vista de viaje', async ({
    page,
    stagingContext,
    loginAsCourier,
  }) => {
    await setupGoogleMapsMock(page);

    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    const requestId = stagingContext.createdRequestIds[0];
    if (!merchant || !courier || !requestId) {
      throw new Error('[E2E Precondition Error] Se requieren merchant, courier y solicitud sembrada');
    }

    // El comercio acepta la oferta del courier 0
    await seedOffersForFirstRequest(stagingContext);
    const before = await getRequestInspectionData(stagingContext, requestId);
    const courierOffer = before.offers.find((o) => o.courierId === courier.id && o.status === 'pending');
    if (!courierOffer) {
      throw new Error('[E2E Precondition Error] No se encontró oferta pendiente para el courier 0');
    }

    const merchantClient = await createAuthenticatedClient(merchant);
    const { error: acceptErr } = await merchantClient.rpc('accept_offer', { p_offer_id: courierOffer.id });
    expect(acceptErr).toBeNull();

    // Repartidor aceptado ingresa a la vista del viaje
    await loginAsCourier(0, page);
    await page.goto(`/trips/${requestId}`);
    await waitForNoSkeletons(page);

    // 1. El mapa de recorrido real debe estar presente y visible, sin fallback (H03)
    const routeMap = page.locator('[data-testid="trip-route-map"]');
    await expect(routeMap).toBeVisible();
    await expect(page.locator('[data-testid="route-map-fallback"]')).toHaveCount(0);

    // 2. Elementos exclusivos del mapa real presentes (H03)
    await expect(page.locator('[data-testid="map-pin-pickup"]')).toBeVisible();
    await expect(page.locator('[data-testid="map-pin-dropoff"]')).toBeVisible();

    // 3. Botón "Abrir en Google Maps" debe estar presente, visible y accesible
    const openGoogleMapsLink = page.getByRole('link', { name: /abrir en google maps/i });
    await expect(openGoogleMapsLink).toBeVisible();
    await expect(openGoogleMapsLink).toHaveAttribute('target', '_blank');

    const rel = await openGoogleMapsLink.getAttribute('rel');
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');

    // 4. Valida URL canónica con new URL(...) (H03)
    const href = await openGoogleMapsLink.getAttribute('href');
    expect(href).toBeTruthy();
    const parsedUrl = new URL(href!);
    expect(parsedUrl.origin).toBe('https://www.google.com');
    expect(parsedUrl.pathname).toBe('/maps/dir/');
    expect(parsedUrl.searchParams.get('api')).toBe('1');
    expect(parsedUrl.searchParams.get('origin')).toBeTruthy();
    expect(parsedUrl.searchParams.get('destination')).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // 5. Degradación graceful cuando Maps API falla
  // ---------------------------------------------------------------------------
  test('DoD: valida degradación graceful cuando Google Maps API falla', async ({
    page,
    stagingContext,
    loginAsCourier,
  }) => {
    // Configurar intercepción simulando falla total de red de Maps
    await setupGoogleMapsMock(page, { failApi: true });

    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    const requestId = stagingContext.createdRequestIds[0];
    if (!merchant || !courier || !requestId) {
      throw new Error('[E2E Precondition Error] Se requieren entidades sembradas');
    }

    await seedOffersForFirstRequest(stagingContext);
    const before = await getRequestInspectionData(stagingContext, requestId);
    const courierOffer = before.offers.find((o) => o.courierId === courier.id && o.status === 'pending');
    if (courierOffer) {
      const merchantClient = await createAuthenticatedClient(merchant);
      await merchantClient.rpc('accept_offer', { p_offer_id: courierOffer.id });
    }

    // Visitar viaje con Maps fallando
    await loginAsCourier(0, page);
    await page.goto(`/trips/${requestId}`);
    await waitForNoSkeletons(page);

    // TripRouteMap degrada a banner de fallback sin colapsar la vista
    const routeMap = page.locator('[data-testid="trip-route-map"]');
    await expect(routeMap).toBeVisible();

    const fallbackMessage = page.locator('[data-testid="route-map-fallback"]');
    await expect(fallbackMessage).toBeVisible();
    await expect(fallbackMessage).toContainText(/no pudimos conectar con google maps/i);

    // En onboarding / picker de comercio, valida degradación visual
    await page.goto('/merchant/onboarding');
    await waitForNoSkeletons(page);

    const mapErrorBanner = page.locator('[data-testid="map-load-error-banner"]');
    const mapFallback = page.locator('[data-testid="map-fallback"]');
    await expect(mapErrorBanner.or(mapFallback).first()).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // 6. Playwright mockea Maps API con 0 llamadas no interceptadas a Google (H04)
  // ---------------------------------------------------------------------------
  test('DoD: Playwright mockea Maps API y garantiza 0 llamadas externas reales a Google', async ({
    page,
  }) => {
    const mock = await setupGoogleMapsMock(page);

    // Navegar y activar carga de Maps interactivo
    await page.goto('/merchant/onboarding');
    await waitForNoSkeletons(page);

    // Exigir que el mock haya interceptado peticiones (> 0) y cero peticiones inesperadas (H04)
    expect(mock.interceptedUrls.length).toBeGreaterThan(0);
    expect(mock.unexpectedGoogleUrls).toEqual([]);
  });
});
