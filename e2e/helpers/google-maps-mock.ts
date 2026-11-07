import type { Page } from '@playwright/test';

/**
 * Stub fail-closed de Google Maps para Playwright (0 llamadas reales a Google). Nació en map-privacy (T-314);
 * T-423 lo movió acá para compartirlo con map-geocoding y le sumó la biblioteca `geocoding`.
 */
export const GOOGLE_MAPS_DOMAINS_REGEX = /(maps\.googleapis\.com|maps\.google\.com|maps\.gstatic\.com)/i;

export interface GoogleMapsMockController {
  interceptedUrls: string[];
  unexpectedGoogleUrls: string[];
}

/**
 * Configura la intercepción estricta fail-closed de Google Maps API en Playwright (0 llamadas reales a Google).
 */
export async function setupGoogleMapsMock(
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
    /**
     * T-423 (CC-045): biblioteca `geocoding`. `found` responde un resultado ROOFTOP en esas coordenadas; `fail`
     * rechaza con REQUEST_DENIED. Cada dirección consultada queda en `window.__geocodeCalls`. Sin la opción,
     * `importLibrary('geocoding')` no trae `Geocoder` (como antes).
     */
    geocode?: { mode: 'found'; lat: number; lng: number } | { mode: 'fail' };
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

          const geocodeOption = ${JSON.stringify(options.geocode ?? null)};
          const geocodingLib = {
            Geocoder: function() {
              this.geocode = function(request) {
                (window.__geocodeCalls ||= []).push(request.address);
                if (geocodeOption.mode === 'fail') {
                  return Promise.reject({ code: 'REQUEST_DENIED' });
                }
                return Promise.resolve({
                  results: [{
                    geometry: {
                      location: new LatLng(geocodeOption.lat, geocodeOption.lng),
                      location_type: 'ROOFTOP'
                    },
                    partial_match: false
                  }]
                });
              };
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
            if (name === 'geocoding' && geocodeOption) return Promise.resolve(geocodingLib);
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
