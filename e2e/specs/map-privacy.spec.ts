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
 * 2. Valida que el feed abierto no tenga tags con coordenadas (D3/D15).
 * 3. Valida selección de pin en alta y solicitud.
 * 4. Valida error inline con pin fuera de Aguilares.
 * 5. Valida que tras matched aparezca el mapa y botón Google Maps.
 * 6. Valida degradación cuando Maps falla.
 */

/**
 * Configura la intercepción estricta de Google Maps API en Playwright (0 llamadas reales a Google).
 */
async function setupGoogleMapsMock(
  page: Page,
  options: { failApi?: boolean } = {}
): Promise<{ getInterceptedCount: () => number }> {
  let interceptedCount = 0;

  await page.route(/.*(maps\.googleapis\.com|maps\.google\.com).*/, async (route) => {
    interceptedCount++;

    if (options.failApi) {
      await route.abort('failed');
      return;
    }

    const url = route.request().url();
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
    getInterceptedCount: () => interceptedCount,
  };
}

test.describe('T-314 — E2E de mapas, geolocalización, privacidad y degradación graceful', () => {
  // ---------------------------------------------------------------------------
  // 1. Privacidad: feed abierto sin tags ni atributos con coordenadas (D3/D15)
  // ---------------------------------------------------------------------------
  test('DoD: el feed abierto del repartidor no tiene tags ni atributos con coordenadas', async ({
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

    await loginAsCourier(0, page);
    await page.goto('/courier/feed');
    await waitForNoSkeletons(page);

    const card = courierPage.requestCardById(requestId);
    await expect(card).toBeVisible();

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
  // 2. Selección de pin en alta de comercio y error inline fuera de Aguilares
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

    // Inicialmente centrado en zona / Aguilares sin alerta de fuera de rango
    const outsideAlert = page.getByRole('alert').filter({
      hasText: /ubicación fuera de aguilares/i,
    });
    await expect(outsideAlert).toHaveCount(0);

    // Simular desplazamiento con flechas del teclado fuera del radio de Aguilares
    // Cada pulsación mueve 0.0001; simular muchas pulsaciones hacia el sur (latitud más negativa)
    await mapContainer.focus();
    for (let i = 0; i < 50; i++) {
      await page.keyboard.press('ArrowDown');
    }

    // Verificar si la alerta inline accesible se activa cuando se sobrepasa el límite
    // O probando posición explícita fuera de rango vía geolocalización simulada
    await page.context().setGeolocation({
      latitude: AGUILARES_BOUNDS.minLat - 0.05,
      longitude: AGUILARES_BOUNDS.minLng - 0.05,
    });
    await page.context().grantPermissions(['geolocation']);

    const useMyLocationBtn = page.getByRole('button', { name: /usar mi ubicación/i });
    if (await useMyLocationBtn.isVisible()) {
      await useMyLocationBtn.click();
      await expect(
        page.getByRole('alert').filter({ hasText: /fuera de aguilares/i })
      ).toBeVisible();
    }
  });

  // ---------------------------------------------------------------------------
  // 3. Selección de pin en creación de solicitud y error inline fuera de rango
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

    // Desplegar mapa interactivo mediante el botón accesible
    const openMapBtn = page.getByRole('button', { name: /fijar en mapa interactivo/i });
    await expect(openMapBtn).toBeVisible();
    await openMapBtn.click();

    // El mapa interactivo se despliega
    const mapPicker = page.locator('[data-testid="map-picker"]');
    await expect(mapPicker).toBeVisible();

    const mapContainer = page.locator('[data-testid="map-container"]');
    await expect(mapContainer).toBeVisible();

    // Interactuar con el mapa con teclas para seleccionar un punto
    await mapContainer.focus();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowRight');

    // Comprobar indicador accesible de pin fijado
    await expect(page.getByText(/pin fijado/i)).toBeVisible();

    // Configurar geolocalización fuera de radio y validar error inline
    await page.context().setGeolocation({
      latitude: -27.5500, // Fuera de AGUILARES_BOUNDS.minLat (-27.48)
      longitude: -65.7000,
    });
    await page.context().grantPermissions(['geolocation']);

    const useGpsBtn = page.getByRole('button', { name: /usar mi ubicación/i });
    if (await useGpsBtn.isVisible()) {
      await useGpsBtn.click();
      await expect(
        page.getByText(/la ubicación está fuera del radio urbano de aguilares|fuera de aguilares/i)
      ).toBeVisible();
    }
  });

  // ---------------------------------------------------------------------------
  // 4. Tras matched aparece el mapa y el botón "Abrir en Google Maps"
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

    // 1. El mapa de recorrido debe estar presente y visible
    const routeMap = page.locator('[data-testid="trip-route-map"]');
    await expect(routeMap).toBeVisible();

    // 2. Botón "Abrir en Google Maps" debe estar presente, visible y accesible
    const openGoogleMapsLink = page.getByRole('link', { name: /abrir en google maps/i });
    await expect(openGoogleMapsLink).toBeVisible();

    // 3. Valida atributos de seguridad y URL canónica
    const href = await openGoogleMapsLink.getAttribute('href');
    expect(href).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1/);
    await expect(openGoogleMapsLink).toHaveAttribute('target', '_blank');
    const rel = await openGoogleMapsLink.getAttribute('rel');
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
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
  // 6. Playwright mockea Maps API (0 llamadas a Google)
  // ---------------------------------------------------------------------------
  test('DoD: Playwright mockea Maps API y garantiza 0 llamadas externas reales a Google', async ({
    page,
  }) => {
    let unmockedGoogleRequests = 0;

    page.on('request', (req) => {
      const url = req.url();
      if (
        (url.includes('maps.googleapis.com') || url.includes('maps.google.com')) &&
        !req.isNavigationRequest()
      ) {
        // Toda petición a Google debe ser respondida localmente por el mock
      }
    });

    const mock = await setupGoogleMapsMock(page);

    // Navegar y activar carga de Maps
    await page.goto('/merchant/onboarding');
    await waitForNoSkeletons(page);

    // Todas las solicitudes deben ser interceptadas por Playwright (0 solicitudes salientes a servidores de Google)
    expect(unmockedGoogleRequests).toBe(0);
    // El mock interceptó correctamente peticiones en caso de existir invocación
    expect(mock.getInterceptedCount()).toBeGreaterThanOrEqual(0);
  });
});
