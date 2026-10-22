import { randomUUID } from 'node:crypto';
import { type Page } from '@playwright/test';
import {
  test,
  expect,
  seedOffersForFirstRequest,
  getRequestInspectionData,
  createAuthenticatedClient,
  trackEntityForCleanup,
  getPlatformSettingNumber,
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
  options: {
    failApi?: boolean;
    simulatedUnexpectedHost?: string;
    /**
     * T-377: biblioteca `routes`. `ok` responde una ruta por calles que pasa por un desvío entre cada par de puntos;
     * `fail` rechaza `Route.computeRoutes`; `reject-import` rechaza la carga misma (`importLibrary('routes')`,
     * PR453-H02). Sin la opción, `importLibrary('routes')` no trae `Route` (como antes).
     */
    routes?: 'ok' | 'fail' | 'reject-import';
  } = {}
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
      let callbackParam = '';
      try {
        callbackParam = new URL(url).searchParams.get('callback') ?? '';
      } catch {
        // Ignorar
      }

      const mockScript = `
        window.google = window.google || {};
        window.google.maps = window.google.maps || {};

        (function() {
          function LatLng(lat, lng) {
            this._lat = typeof lat === 'function' ? lat() : Number(lat);
            this._lng = typeof lng === 'function' ? lng() : Number(lng);
            this.lat = function() { return this._lat; };
            this.lng = function() { return this._lng; };
            this.toJSON = function() { return { lat: this._lat, lng: this._lng }; };
          }

          function LatLngBounds() {
            this.contains = function() { return true; };
            this.extend = function() { return this; };
            this.getCenter = function() { return new LatLng(-27.4333, -65.6167); };
          }

          function MVCArray() {
            this._items = [];
            this.push = function(elem) { this._items.push(elem); return this._items.length; };
            this.getArray = function() { return this._items; };
            this.removeAt = function(i) { return this._items.splice(i, 1)[0]; };
            this.clear = function() { this._items.length = 0; };
            this.getLength = function() { return this._items.length; };
          }

          function Map(element, opts) {
            this._element = element;
            this._center = opts?.center || opts?.defaultCenter || new LatLng(-27.4333, -65.6167);
            this._zoom = opts?.zoom || opts?.defaultZoom || 14;
            this._listeners = {};
            this.controls = Array.from({ length: 20 }, () => new MVCArray());

            this.getDiv = function() { return this._element; };
            this.setCenter = function(c) {
              this._center = c;
              this._trigger('center_changed');
            };
            this.getCenter = function() {
              const c = this._center;
              return {
                lat: function() { return typeof c.lat === 'function' ? c.lat() : c.lat; },
                lng: function() { return typeof c.lng === 'function' ? c.lng() : c.lng; }
              };
            };
            this.panTo = function(c) { this.setCenter(c); };
            this.setZoom = function(z) { this._zoom = z; this._trigger('zoom_changed'); };
            this.getZoom = function() { return this._zoom; };
            this.getHeading = function() { return 0; };
            this.getTilt = function() { return 0; };
            this.getBounds = function() { return new LatLngBounds(); };
            this.setOptions = function(o) { Object.assign(this, o); };
            this.moveCamera = function(c) {
              if (c.center) this.setCenter(c.center);
              if (c.zoom != null) this.setZoom(c.zoom);
            };
            this.fitBounds = function(bounds, padding) {
              (window.__routeFitBoundsCalls ||= []).push({ bounds: bounds, padding: padding });
            };

            this.addListener = function(name, handler) {
              (this._listeners[name] ||= []).push(handler);
              return {
                remove: () => {
                  this._listeners[name] = (this._listeners[name] ?? []).filter((h) => h !== handler);
                }
              };
            };

            this._trigger = function(name, event) {
              const handlers = (this._listeners[name] || []).slice();
              for (const h of handlers) h(event);
            };
          }

          function AdvancedMarkerElement(opts) {
            this._map = null;
            this._content = null;
            this._position = opts?.position || null;
            this._title = opts?.title || '';
            this._zIndex = null;
            this._collisionBehavior = null;
            this.gmpDraggable = false;
            this.gmpClickable = true;
            this._listeners = {};

            this.addListener = function(name, handler) {
              (this._listeners[name] ||= []).push(handler);
              return {
                remove: () => {
                  this._listeners[name] = (this._listeners[name] ?? []).filter((h) => h !== handler);
                }
              };
            };

            this._attachContent = () => {
              if (this._map && this._content) {
                const container =
                  (typeof this._map.getDiv === 'function' ? this._map.getDiv() : this._map._element) ||
                  (this._map instanceof HTMLElement ? this._map : null);
                if (container && !container.contains(this._content)) {
                  container.appendChild(this._content);
                }
              }
            };

            Object.defineProperty(this, 'map', {
              get: () => this._map,
              set: (m) => {
                this._map = m;
                this._attachContent();
              }
            });

            Object.defineProperty(this, 'content', {
              get: () => this._content,
              set: (c) => {
                if (this._content && this._content.parentNode) {
                  this._content.parentNode.removeChild(this._content);
                }
                this._content = c;
                this._attachContent();
              }
            });

            Object.defineProperty(this, 'position', {
              get: () => this._position,
              set: (p) => { this._position = p; }
            });

            Object.defineProperty(this, 'title', {
              get: () => this._title,
              set: (t) => { this._title = t; }
            });

            Object.defineProperty(this, 'zIndex', {
              get: () => this._zIndex,
              set: (z) => { this._zIndex = z; }
            });

            Object.defineProperty(this, 'collisionBehavior', {
              get: () => this._collisionBehavior,
              set: (cb) => { this._collisionBehavior = cb; }
            });

            if (opts?.map) this.map = opts.map;
            if (opts?.content) this.content = opts.content;
          }

          function Marker(opts) {
            opts = opts || {};
            this._map = opts.map ?? null;
            this._pos = opts.position ?? null;
            this._draggable = Boolean(opts.draggable);
            this._title = opts.title ?? '';
            this._visible = opts.visible !== false;
            this._listeners = {};

            this.setMap = function(m) { this._map = m; };
            this.getMap = function() { return this._map; };
            this.setPosition = function(p) { this._pos = p; };
            this.getPosition = function() { return this._pos; };
            this.setDraggable = function(v) { this._draggable = Boolean(v); };
            this.getDraggable = function() { return this._draggable; };
            this.setTitle = function(v) { this._title = v; };
            this.getTitle = function() { return this._title; };
            this.setVisible = function(v) { this._visible = Boolean(v); };
            this.getVisible = function() { return this._visible; };

            this.setOptions = function(o) {
              if (!o) return;
              if ('position' in o) this.setPosition(o.position);
              if ('map' in o) this.setMap(o.map);
              if ('draggable' in o) this.setDraggable(o.draggable);
              if ('title' in o) this.setTitle(o.title);
              if ('visible' in o) this.setVisible(o.visible);
            };

            this.addListener = function(name, handler) {
              (this._listeners[name] ||= []).push(handler);
              return {
                remove: () => {
                  this._listeners[name] = (this._listeners[name] ?? []).filter((h) => h !== handler);
                }
              };
            };
          }

          function PinElement() {
            this.element = document.createElement('div');
            this.element.className = 'gm-pin-element';
          }

          function toLiteral(pt) {
            const lat = typeof pt.lat === 'function' ? pt.lat() : pt.lat;
            const lng = typeof pt.lng === 'function' ? pt.lng() : pt.lng;
            return { lat: Number(lat), lng: Number(lng) };
          }

          function Polyline(opts) {
            this._path = new MVCArray();
            // T-377: la última geometría dibujada queda visible para las aserciones del E2E.
            const recordPath = () => {
              window.__routePolylinePath = this._path.getArray().map(toLiteral);
            };
            if (Array.isArray(opts?.path)) {
              opts.path.forEach((pt) => this._path.push(pt));
              recordPath();
            }
            this.setPath = function(p) {
              this._path.clear();
              if (Array.isArray(p)) {
                p.forEach((pt) => this._path.push(pt));
              }
              recordPath();
            };
            this.getPath = function() { return this._path; };
            this.setMap = function() {};
            this.setOptions = function(o) {
              if (o && Array.isArray(o.path)) this.setPath(o.path);
            };
            this.addListener = function() { return { remove: function() {} }; };
          }

          const settingsInstance = {
            fetchAppCheckToken: null
          };

          const settingsLib = {
            getInstance: function() {
              return settingsInstance;
            }
          };

          const markerLib = {
            AdvancedMarkerElement: AdvancedMarkerElement,
            PinElement: PinElement,
            Marker: Marker
          };

          const mapsLib = {
            Map: Map,
            Polyline: Polyline,
            Settings: settingsLib,
            ControlPosition: {
              TOP_LEFT: 1,
              TOP_CENTER: 2,
              TOP_RIGHT: 3,
              LEFT_TOP: 4,
              LEFT_CENTER: 5,
              LEFT_BOTTOM: 6,
              RIGHT_TOP: 7,
              RIGHT_CENTER: 8,
              RIGHT_BOTTOM: 9,
              BOTTOM_LEFT: 10,
              BOTTOM_CENTER: 11,
              BOTTOM_RIGHT: 12
            }
          };

          const coreLib = {
            LatLng: LatLng,
            LatLngBounds: LatLngBounds,
            MVCArray: MVCArray,
            Settings: settingsLib,
            event: {
              addListener: function(instance, name, handler) {
                if (instance && typeof instance.addListener === 'function') {
                  return instance.addListener(name, handler);
                }
                return { remove: function() {} };
              },
              removeListener: function(handle) {
                if (handle && typeof handle.remove === 'function') handle.remove();
              },
              trigger: function(instance, name, event) {
                if (instance && typeof instance._trigger === 'function') instance._trigger(name, event);
              },
              clearInstanceListeners: function(instance) {
                if (instance && instance._listeners) {
                  instance._listeners = {};
                }
              }
            }
          };

          const routesMode = ${JSON.stringify(options.routes ?? 'missing')};
          const routesLib = {
            Route: {
              computeRoutes: function(request) {
                (window.__computeRoutesCalls ||= []).push(JSON.parse(JSON.stringify(request)));
                if (routesMode === 'fail') {
                  return Promise.reject(new Error('REQUEST_DENIED'));
                }
                const stops = [request.origin]
                  .concat((request.intermediates || []).map(function(w) { return w.location; }))
                  .concat([request.destination])
                  .map(toLiteral);
                const path = [];
                stops.forEach(function(stop, index) {
                  path.push(stop);
                  const next = stops[index + 1];
                  // Desvío en ángulo recto: la geometría por calles nunca coincide con la línea recta.
                  if (next) path.push({ lat: stop.lat, lng: next.lng });
                });
                return Promise.resolve({ routes: [{ path: path }], fallbackInfo: null, geocodingResults: null });
              }
            }
          };

          const geometryLib = {
            encoding: {
              decodePath: function() { return []; }
            }
          };

          window.google.maps.Settings = settingsLib;
          window.google.maps.version = '3.62.9';
          window.google.maps.CollisionBehavior = {
            REQUIRED: 'REQUIRED',
            REQUIRED_AND_HIDES_OPTIONAL: 'REQUIRED_AND_HIDES_OPTIONAL',
            OPTIONAL_AND_HIDES_LOWER_PRIORITY: 'OPTIONAL_AND_HIDES_LOWER_PRIORITY'
          };
          window.google.maps.ControlPosition = mapsLib.ControlPosition;
          window.google.maps.MVCArray = MVCArray;
          window.google.maps.Map = Map;
          window.google.maps.Marker = Marker;
          window.google.maps.Polyline = Polyline;
          window.google.maps.LatLng = LatLng;
          window.google.maps.LatLngBounds = LatLngBounds;
          window.google.maps.event = coreLib.event;
          window.google.maps.marker = markerLib;

          window.google.maps.importLibrary = function(name) {
            if (name === 'marker') return Promise.resolve(markerLib);
            if (name === 'maps') return Promise.resolve(mapsLib);
            if (name === 'core') return Promise.resolve(coreLib);
            if (name === 'geometry') return Promise.resolve(geometryLib);
            if (name === 'routes' && routesMode === 'reject-import') {
              return Promise.reject(new Error('ROUTES_LIBRARY_LOAD_FAILED'));
            }
            if (name === 'routes' && routesMode !== 'missing') return Promise.resolve(routesLib);
            return Promise.resolve(window.google.maps);
          };

          ${callbackParam ? `
          try {
            const cb = '${callbackParam}';
            const fn = cb.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), window);
            if (typeof fn === 'function') {
              fn();
            }
          } catch {}
          ` : ''}
        })();
      `;
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: mockScript,
      });
      return;
    }

    if (url.endsWith('.css') || url.includes('/style')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/css',
        body: '',
      });
      return;
    }

    if (url.endsWith('.js') || url.includes('/js/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '',
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

    // Captura explícita del endpoint vivo interceptándolo antes de navegar (H01)
    const liveBodies: string[] = [];
    await page.route('**/api/live/available-requests*', async (route) => {
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      const body = await response.text();
      liveBodies.push(body);
      await route.fulfill({ response });
    });

    await loginAsCourier(0, page);
    await page.goto('/courier/feed');
    await waitForNoSkeletons(page);

    const card = courierPage.requestCardById(requestId);
    await expect(card).toBeVisible();

    // Exigir positivamente que el endpoint vivo fue observado y su body no contiene centinelas (H01)
    await expect.poll(() => liveBodies.length).toBeGreaterThan(0);
    for (const body of liveBodies) {
      for (const sentinel of SENTINEL_COORDINATES) {
        expect(body, `fuga en endpoint vivo: centinela ${sentinel}`).not.toContain(sentinel);
      }
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

    // T-363 / T-388: la distancia refleja el dato real de la solicitud (route_distance_m, la que escribe la
    // publicación). Sin ella se declara «Distancia no calculada»; nunca se inventa un valor.
    const courier = stagingContext.courierUsers?.[0];
    if (!courier) {
      throw new Error('[E2E Precondition Error] Se requiere el courier sembrado');
    }
    const courierClient = await createAuthenticatedClient(courier);
    const { data: distanceRow, error: distanceErr } = await courierClient
      .from('delivery_requests')
      .select('route_distance_m')
      .eq('id', requestId)
      .single();
    expect(distanceErr).toBeNull();
    // La semilla publica sin route_distance_m: precondición explícita, sin ramas condicionales
    expect(distanceRow?.route_distance_m).toBeNull();
    await expect(card.getByText('Distancia no calculada')).toBeVisible();
    await expect(card.getByText(/km/i)).toHaveCount(0);
  });

  // ---------------------------------------------------------------------------
  // 2. Selección de pin en alta de comercio y error inline fuera de Aguilares (H02)
  // ---------------------------------------------------------------------------
  test('DoD: selección de pin en alta de comercio valida límites y muestra error inline fuera de Aguilares', async ({
    page,
    stagingContext,
    loginAsMerchant,
  }) => {
    await setupGoogleMapsMock(page);

    await loginAsMerchant(page);
    await page.goto('/merchant/onboarding');
    await expect(page).toHaveURL(/\/merchant\/onboarding(?:\/|$)/);
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

    // Verificar que existen exactamente 2 botones "Usar mi ubicación" (retiro y entrega) en el formulario (H02)
    await expect(page.getByRole('button', { name: /^usar mi ubicación$/i })).toHaveCount(2);

    // GPS de la primera entrega: locator semántico de la Card multi-drop
    const dropoffCard = page.getByTestId('drop-card-0');
    await expect(dropoffCard).toBeVisible();
    const deliveryGps = dropoffCard.getByRole('button', {
      name: /^usar mi ubicación$/i,
    });
    await expect(deliveryGps).toHaveCount(1);
    await expect(deliveryGps).toBeVisible();
    await deliveryGps.click();

    // Comprobar error de coordenadas fuera de radio acotado a la entrega (H02)
    await expect(
      dropoffCard.getByText(/la ubicación está fuera del radio urbano de aguilares|fuera de aguilares/i)
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
    await setupGoogleMapsMock(page, { routes: 'ok' });

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

    // 5. T-377: una sola llamada a Route.computeRoutes con el contrato de la ficha y la geometría por calles dibujada
    const readComputeRoutesCalls = (target: Page) =>
      target.evaluate(
        () =>
          (window as unknown as { __computeRoutesCalls?: Array<Record<string, unknown>> }).__computeRoutesCalls ?? []
      );
    const readPolylinePath = (target: Page) =>
      target.evaluate(
        () =>
          (window as unknown as { __routePolylinePath?: Array<{ lat: number; lng: number }> })
            .__routePolylinePath ?? []
      );
    const streetFallbackText = 'Línea recta orientativa; la ruta por calles no está disponible';

    await expect.poll(async () => (await readComputeRoutesCalls(page)).length).toBe(1);
    const [computeRoutesRequest] = await readComputeRoutesCalls(page);
    expect(computeRoutesRequest).toMatchObject({
      travelMode: 'DRIVING',
      fields: ['path'],
      optimizeWaypointOrder: false,
      intermediates: [],
    });
    const origin = computeRoutesRequest?.['origin'] as { lat: number; lng: number } | undefined;
    const destination = computeRoutesRequest?.['destination'] as { lat: number; lng: number } | undefined;
    expect(typeof origin?.lat).toBe('number');
    expect(typeof destination?.lat).toBe('number');
    // El mock responde retiro → desvío → entrega: la traza tiene 3 puntos, no la recta de 2.
    await expect.poll(async () => (await readPolylinePath(page)).length).toBe(3);
    const streetPath = await readPolylinePath(page);
    expect(streetPath[0]).toEqual(origin);
    expect(streetPath[2]).toEqual(destination);
    await expect(page.getByText(streetFallbackText)).toHaveCount(0);

    // 6. T-377: con la ruta forzada a fallar, línea recta con el texto de fallback y el resto de la vista intacta
    const failPage = await page.context().newPage();
    try {
      await setupGoogleMapsMock(failPage, { routes: 'fail' });
      await failPage.goto(`/trips/${requestId}`);
      await waitForNoSkeletons(failPage);

      await expect(failPage.getByText(streetFallbackText)).toBeVisible();
      await expect.poll(async () => (await readComputeRoutesCalls(failPage)).length).toBe(1);
      await expect.poll(async () => (await readPolylinePath(failPage)).length).toBe(2);
      expect(await readPolylinePath(failPage)).toEqual([origin, destination]);
      await expect(failPage.locator('[data-testid="route-map-fallback"]')).toHaveCount(0);
      await expect(failPage.getByRole('link', { name: /abrir en google maps/i })).toBeVisible();
    } finally {
      await failPage.close();
    }

    // 7. PR453-H02: si falla la carga de `routes` (no el cálculo), Maps JS sigue, recta con aviso y sin unhandledrejection
    const rejectPage = await page.context().newPage();
    try {
      await rejectPage.addInitScript(() => {
        const store = window as unknown as { __unhandledRejections?: string[] };
        store.__unhandledRejections = [];
        window.addEventListener('unhandledrejection', (event) => {
          store.__unhandledRejections?.push(String(event.reason));
        });
      });
      await setupGoogleMapsMock(rejectPage, { routes: 'reject-import' });
      await rejectPage.goto(`/trips/${requestId}`);
      await waitForNoSkeletons(rejectPage);

      await expect(rejectPage.getByText(streetFallbackText)).toBeVisible();
      await expect(rejectPage.locator('[data-testid="route-map-fallback"]')).toHaveCount(0);
      await expect(rejectPage.locator('[data-testid="map-pin-pickup"]')).toBeVisible();
      await expect.poll(async () => (await readPolylinePath(rejectPage)).length).toBe(2);
      expect(await readPolylinePath(rejectPage)).toEqual([origin, destination]);
      expect(await readComputeRoutesCalls(rejectPage)).toEqual([]);
      await expect(rejectPage.getByRole('link', { name: /abrir en google maps/i })).toBeVisible();
      const unhandled = await rejectPage.evaluate(
        () => (window as unknown as { __unhandledRejections?: string[] }).__unhandledRejections ?? []
      );
      expect(unhandled).toEqual([]);
    } finally {
      await rejectPage.close();
    }
  });

  // ---------------------------------------------------------------------------
  // 5. Degradación graceful cuando Maps API falla
  // ---------------------------------------------------------------------------
  test('DoD: valida degradación graceful cuando Google Maps API falla', async ({
    page,
    browser,
    stagingContext,
    loginAsCourier,
    loginAsMerchant,
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

    // En onboarding / picker de comercio, valida degradación visual en un contexto aislado de comercio (H06)
    const merchantContext = await browser.newContext({
      baseURL: new URL(page.url()).origin,
    });
    try {
      const merchantPage = await merchantContext.newPage();
      await setupGoogleMapsMock(merchantPage, { failApi: true });
      await loginAsMerchant(merchantPage);
      await merchantPage.goto('/merchant/onboarding');
      await expect(merchantPage).toHaveURL(/\/merchant\/onboarding(?:\/|$)/);
      await waitForNoSkeletons(merchantPage);

      const mapErrorBanner = merchantPage.locator('[data-testid="map-load-error-banner"]');
      const mapFallback = merchantPage.locator('[data-testid="map-fallback"]');
      await expect(mapErrorBanner.or(mapFallback).first()).toBeVisible();
    } finally {
      await merchantContext.close();
    }
  });

  // ---------------------------------------------------------------------------
  // 6. Playwright mockea Maps API con 0 llamadas no interceptadas a Google (H04)
  // ---------------------------------------------------------------------------
  test('DoD: Playwright mockea Maps API y garantiza 0 llamadas externas reales a Google', async ({
    page,
    stagingContext,
    loginAsMerchant,
  }) => {
    const mock = await setupGoogleMapsMock(page);

    // Autenticar como merchant antes de acceder a la ruta protegida (H06)
    await loginAsMerchant(page);
    await page.goto('/merchant/onboarding');
    await expect(page).toHaveURL(/\/merchant\/onboarding(?:\/|$)/);
    await waitForNoSkeletons(page);

    // Smoke positivo: verificar que el mapa se montó y no colapsó en error boundary (H07)
    await expect(page.locator('[data-testid="map-picker"]')).toBeVisible();
    await expect(page.locator('[data-testid="map-container"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: /no pudimos cargar el alta del comercio/i })).toHaveCount(0);

    // Exigir que el mock haya interceptado peticiones (> 0) y cero peticiones inesperadas (H04)
    expect(mock.interceptedUrls.length).toBeGreaterThan(0);
    expect(mock.unexpectedGoogleUrls).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // 7. T-363: viaje sin coordenadas con proveedor disponible (caso de #351)
  // ---------------------------------------------------------------------------
  test('T-388: una solicitud publicada entre barrios con centroide muestra en el feed la distancia que calculó el servidor', async ({
    page,
    courierPage,
    stagingContext,
    loginAsCourier,
  }) => {
    await setupGoogleMapsMock(page);
    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    if (!merchant || !courier) {
      throw new Error('[E2E Precondition Error] Se requieren merchant y courier sembrados');
    }

    // Dos barrios activos con centroide (T-326): la distancia sale de los centroides, sin pines.
    const merchantClient = await createAuthenticatedClient(merchant);
    const { data: zones, error: zonesErr } = await merchantClient
      .from('zones')
      .select('id, name')
      .in('name', ['San Martín', 'Villa Nueva'])
      .eq('active', true);
    expect(zonesErr).toBeNull();
    const pickupZoneId = zones?.find((z) => z.name === 'San Martín')?.id;
    const dropoffZoneId = zones?.find((z) => z.name === 'Villa Nueva')?.id;
    if (!pickupZoneId || !dropoffZoneId) {
      throw new Error('[E2E Precondition Error] Faltan los barrios San Martín y Villa Nueva activos');
    }

    const requestId = randomUUID();
    trackEntityForCleanup(stagingContext, 'request', requestId);
    const { error: publishErr } = await merchantClient.rpc('create_and_publish_multi_drop', {
      p_payload: {
        requestId,
        pickupZoneId,
        pickupAddress: `Alberdi 150 T388 ${stagingContext.testRunId}`,
        pickupLat: null,
        pickupLng: null,
        fixedPriceArs: null,
        autoAssign: false,
        drops: [
          {
            dropoffZoneId,
            dropoffAddress: `Mitre 450 T388 ${stagingContext.testRunId}`,
            dropoffLat: null,
            dropoffLng: null,
            recipientName: 'Cliente T388',
            recipientPhone: '3865123456',
            recipientConsentDeclared: true,
            packageType: 'chico',
            recipientPaymentMethod: 'transfer',
            needsChange: false,
            cashChangeAmount: null,
            notes: null,
          },
        ],
      },
    });
    expect(publishErr).toBeNull();

    // Oráculo: la distancia total que guardó la publicación, leída como el repartidor (grant de CC-023).
    const courierClient = await createAuthenticatedClient(courier);
    const { data: row, error: rowErr } = await courierClient
      .from('delivery_requests')
      .select('route_distance_m')
      .eq('id', requestId)
      .single();
    expect(rowErr).toBeNull();
    const routeDistanceM = row?.route_distance_m ?? null;
    expect(routeDistanceM).not.toBeNull();
    expect((routeDistanceM ?? 0) % 500).toBe(0);
    const expectedKm = (Math.round(((routeDistanceM ?? 0) / 1000) * 2) / 2).toFixed(1).replace('.', ',');

    await loginAsCourier(0, page);
    await page.waitForURL(/\/courier\/feed/);
    await waitForNoSkeletons(page);
    const card = courierPage.requestCardById(requestId);
    await expect(card).toBeVisible();
    await expect(card.getByText(`≈ ${expectedKm} km`)).toBeVisible();
    await expect(card.getByText('Distancia no calculada')).toHaveCount(0);
    // D3/D15: solo barrios y distancia aproximada; ni mapa ni coordenadas en el feed.
    await expect(page.locator('[data-testid="trip-route-map"]')).toHaveCount(0);
    expect(await card.innerText()).not.toMatch(/-27\.\d{3,}|-65\.\d{3,}/);
  });

  test('T-363: sin coordenadas el viaje explica el fallback, no inventa distancia y Google Maps usa las direcciones escritas', async ({
    page,
    stagingContext,
    loginAsCourier,
  }) => {
    // Proveedor disponible: el fallback solo puede deberse a la falta de coordenadas
    const mock = await setupGoogleMapsMock(page);

    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    if (!merchant || !courier) {
      throw new Error('[E2E Precondition Error] Se requieren merchant y courier sembrados');
    }

    const merchantClient = await createAuthenticatedClient(merchant);
    const { data: zones, error: zonesErr } = await merchantClient
      .from('zones')
      .select('id')
      .eq('active', true)
      .limit(1);
    expect(zonesErr).toBeNull();
    const zoneId = zones?.[0]?.id;
    if (!zoneId) {
      throw new Error('[E2E Precondition Error] No hay zonas activas para publicar la solicitud');
    }

    // Solicitud publicada por la RPC real con direcciones escritas y sin pin (pares de coordenadas nulos)
    const requestId = randomUUID();
    const pickupAddress = `Alberdi 150 T363 ${stagingContext.testRunId}`;
    const dropoffAddress = `Mitre 450 T363 ${stagingContext.testRunId}`;
    trackEntityForCleanup(stagingContext, 'request', requestId);
    const { error: publishErr } = await merchantClient.rpc('create_and_publish_multi_drop', {
      p_payload: {
        requestId,
        pickupZoneId: zoneId,
        pickupAddress,
        pickupLat: null,
        pickupLng: null,
        fixedPriceArs: null,
        autoAssign: false,
        drops: [
          {
            dropoffZoneId: zoneId,
            dropoffAddress,
            dropoffLat: null,
            dropoffLng: null,
            recipientName: 'Cliente T363',
            recipientPhone: '3865123456',
            recipientConsentDeclared: true,
            packageType: 'chico',
            recipientPaymentMethod: 'transfer',
            needsChange: false,
            cashChangeAmount: null,
            notes: null,
          },
        ],
      },
    });
    expect(publishErr).toBeNull();

    const courierClient = await createAuthenticatedClient(courier);
    const { data: offerData, error: offerErr } = await courierClient.rpc('submit_offer', {
      p_request_id: requestId,
      p_amount_ars: 1500,
      p_eta_minutes: 15,
      p_message: 'Oferta T-363 sin coordenadas',
    });
    expect(offerErr).toBeNull();
    const offerId = (offerData as { offerId?: string } | null)?.offerId;
    if (!offerId) {
      throw new Error('[E2E Error] submit_offer no devolvió offerId');
    }
    trackEntityForCleanup(stagingContext, 'offer', offerId);

    const { error: acceptErr } = await merchantClient.rpc('accept_offer', { p_offer_id: offerId });
    expect(acceptErr).toBeNull();

    await loginAsCourier(0, page);
    await page.goto(`/trips/${requestId}`);
    await waitForNoSkeletons(page);

    const routeMap = page.locator('[data-testid="trip-route-map"]');
    await expect(routeMap).toBeVisible();

    // Fallback explícito por falta de ubicación exacta, nunca «modo simplificado» ni pines inventados
    const fallback = page.locator('[data-testid="route-map-fallback"]');
    await expect(fallback).toBeVisible();
    await expect(fallback).toContainText(/sin ubicación exacta en el mapa/i);
    await expect(fallback).not.toContainText(/modo simplificado/i);
    await expect(page.locator('[data-testid="route-map-missing-points"]')).toHaveText('retiro, entrega');
    await expect(page.locator('[data-testid="map-pin-pickup"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="map-pin-dropoff"]')).toHaveCount(0);

    // La distancia es la calculada en servidor o se declara no calculada; nunca un «km» vacío
    await expect(page.locator('[data-testid="route-map-distance"]')).toHaveText(
      /^(Distancia no calculada|≈ \d+,\d km)$/
    );

    // Google Maps recibe las direcciones escritas tal cual, sin coordenadas inventadas
    const href = await page.getByRole('link', { name: /abrir en google maps/i }).getAttribute('href');
    expect(href).toBeTruthy();
    const parsedUrl = new URL(href ?? '');
    expect(parsedUrl.origin).toBe('https://www.google.com');
    expect(parsedUrl.searchParams.get('origin')).toBe(pickupAddress);
    expect(parsedUrl.searchParams.get('destination')).toBe(dropoffAddress);
    expect(parsedUrl.searchParams.get('waypoints')).toBeNull();

    // Sin coordenadas no se carga Google Maps ni se llama a Google fuera del mock
    expect(mock.unexpectedGoogleUrls).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // 8. PR386-H01/H02: viaje multi-drop post-match navega por tramos y encuadra todos los pines
  // ---------------------------------------------------------------------------
  test('PR386-H01/H02: con 5 entregas geolocalizadas el viaje encuadra los 6 pines y navega en 2 tramos continuos', async ({
    page,
    stagingContext,
    loginAsCourier,
  }) => {
    await setupGoogleMapsMock(page);

    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    if (!merchant || !courier) {
      throw new Error('[E2E Precondition Error] Se requieren merchant y courier sembrados');
    }
    const maxDrops = await getPlatformSettingNumber('max_drops_per_request');
    if (maxDrops < 5) {
      throw new Error(`[E2E Precondition Error] max_drops_per_request=${maxDrops}; el caso requiere 5`);
    }

    const merchantClient = await createAuthenticatedClient(merchant);
    const { data: zones, error: zonesErr } = await merchantClient
      .from('zones')
      .select('id')
      .eq('active', true)
      .limit(1);
    expect(zonesErr).toBeNull();
    const zoneId = zones?.[0]?.id;
    if (!zoneId) {
      throw new Error('[E2E Precondition Error] No hay zonas activas para publicar la solicitud');
    }

    const pickup = { lat: -27.44, lng: -65.62 };
    const dropPoints = [
      { lat: -27.43, lng: -65.61 },
      { lat: -27.42, lng: -65.6 },
      { lat: -27.41, lng: -65.615 },
      { lat: -27.45, lng: -65.605 },
      { lat: -27.46, lng: -65.625 },
    ];
    const requestId = randomUUID();
    trackEntityForCleanup(stagingContext, 'request', requestId);
    const { error: publishErr } = await merchantClient.rpc('create_and_publish_multi_drop', {
      p_payload: {
        requestId,
        pickupZoneId: zoneId,
        pickupAddress: `Alberdi 150 PR386 ${stagingContext.testRunId}`,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        fixedPriceArs: null,
        autoAssign: false,
        drops: dropPoints.map((point, index) => ({
          dropoffZoneId: zoneId,
          dropoffAddress: `Mitre ${(index + 1) * 10} PR386`,
          dropoffLat: point.lat,
          dropoffLng: point.lng,
          recipientName: `Cliente PR386 ${index + 1}`,
          recipientPhone: `386510000${index + 1}`,
          recipientConsentDeclared: true,
          packageType: 'chico',
          recipientPaymentMethod: 'transfer',
          needsChange: false,
          cashChangeAmount: null,
          notes: null,
        })),
      },
    });
    expect(publishErr).toBeNull();

    const courierClient = await createAuthenticatedClient(courier);
    const { data: offerData, error: offerErr } = await courierClient.rpc('submit_offer', {
      p_request_id: requestId,
      p_amount_ars: 1500,
      p_eta_minutes: 15,
      p_message: 'Oferta PR386 multi-drop',
    });
    expect(offerErr).toBeNull();
    const offerId = (offerData as { offerId?: string } | null)?.offerId;
    if (!offerId) {
      throw new Error('[E2E Error] submit_offer no devolvió offerId');
    }
    trackEntityForCleanup(stagingContext, 'offer', offerId);

    const { error: acceptErr } = await merchantClient.rpc('accept_offer', { p_offer_id: offerId });
    expect(acceptErr).toBeNull();

    await loginAsCourier(0, page);
    await page.goto(`/trips/${requestId}`);
    await waitForNoSkeletons(page);

    // Mapa real con los 6 pines (retiro + 5 entregas), sin fallback
    await expect(page.locator('[data-testid="trip-route-map"]')).toBeVisible();
    await expect(page.locator('[data-testid="route-map-fallback"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="map-pin-"]')).toHaveCount(6);

    // H02: la cámara se encuadra con los límites de todos los puntos válidos
    type FitBoundsCall = { bounds: { north: number; south: number; east: number; west: number }; padding: number };
    const readFitBounds = () =>
      page.evaluate(
        () => (window as unknown as { __routeFitBoundsCalls?: FitBoundsCall[] }).__routeFitBoundsCalls ?? []
      );
    await expect.poll(async () => (await readFitBounds()).length).toBeGreaterThan(0);
    const fitCalls = await readFitBounds();
    expect(fitCalls.at(-1)?.bounds).toEqual({ north: -27.41, south: -27.46, east: -65.6, west: -65.625 });

    // H01: dos tramos continuos, ≤3 paradas intermedias y ≤2048 caracteres cada uno
    await expect(page.getByRole('link', { name: /abrir en google maps/i })).toHaveCount(0);
    const asParam = (point: { lat: number; lng: number }) => `${point.lat},${point.lng}`;
    const legStops = async (name: RegExp) => {
      const link = page.getByRole('link', { name });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('target', '_blank');
      const rel = (await link.getAttribute('rel')) ?? '';
      expect(rel).toContain('noopener');
      expect(rel).toContain('noreferrer');
      const href = (await link.getAttribute('href')) ?? '';
      expect(href.length).toBeLessThanOrEqual(2048);
      const url = new URL(href);
      expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/');
      const waypoints = url.searchParams.get('waypoints');
      return [
        url.searchParams.get('origin'),
        ...(waypoints ? waypoints.split('|') : []),
        url.searchParams.get('destination'),
      ];
    };
    const first = await legStops(/abrir tramo 1 de 2/i);
    const second = await legStops(/abrir tramo 2 de 2/i);
    expect(first).toEqual([pickup, ...dropPoints.slice(0, 4)].map(asParam));
    expect(second).toEqual(dropPoints.slice(3).map(asParam));

    // Sin tracking en vivo del repartidor
    await expect(page.locator('[data-testid="map-pin-courier"]')).toHaveCount(0);
  });
});
