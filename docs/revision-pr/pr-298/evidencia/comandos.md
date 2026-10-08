# Evidencia y probes — PR #298

## Ronda 1

Ver `revisiones/ronda-1.md`.

## Ronda 2 — SHA e72a457

### H01 · el canal vivo no es obligatorio

Producto, `src/features/offers/hooks/use-available-requests.ts`:
```text
initialData = initialRequests
initialDataUpdatedAt = 0
staleTime = 0
fetch('/api/live/available-requests')
```

Spec:
```text
card visible
await Promise.all(pendingResponseReads)
expect(leakedResponses).toEqual([])
```

No hay assert que pruebe que `/api/live/available-requests` haya sido observado. `Promise.all(array)` toma los elementos presentes al invocarse; promesas agregadas luego por eventos `response` no forman parte de esa espera.

### H02 · locator ambiguo

Producto:
```text
pickup  -> "Usar mi ubicación"
dropoff -> "Usar mi ubicación"
```

Spec:
```ts
page.getByRole('button', { name: /usar mi ubicación/i })
```

Resultado lógico: 2 matches; no identifica el control de entrega.

### H03/H04

Inspección del SHA confirma ausencia de fallback + markers en H03 y `interceptedUrls > 0` + `unexpectedGoogleUrls=[]` en H04.

### CI

CI run `37694152798`: todos los jobs observados success (db-tests, audit, typecheck, build, unit, lint, bundle-budget).

Trusted E2E run `37694273759`: in progress al cierre de R2.

### Comandos para la siguiente corrección

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm exec playwright test e2e/specs/map-privacy.spec.ts --list
pnpm exec playwright test e2e/specs/map-privacy.spec.ts --project=chromium
git status --short
git diff --name-only origin/develop...HEAD
```

## Ronda 3 — SHA `67de7f9a045541c6897882974329252d4f2ed1a6`

### Fuente ejecutada externa: trusted E2E previo

GitHub Actions run `37694273759`, job `113041979728`, probado sobre `e72a457` (NO sobre `67de7f9`): salida real `5 failed / 44 passed`. Identificación completa de las fallas:
```text
map-privacy alta comercio: locator('[data-testid="map-picker"]') no encontrado.
map-privacy solicitud: strict mode violation: getByRole('button', { name: /usar mi ubicación/i }) resolved to 2 elements.
map-privacy postmatched: locator('[data-testid="map-pin-pickup"]') no encontrado.
map-privacy graceful: locator('[data-testid="map-load-error-banner"]').or(locator('[data-testid="map-fallback"]')).first() no encontrado.
map-privacy mock: interceptedUrls.length esperado >0, recibido 0.
```

Causas inferidas por cruce con producción:
- `src/features/auth/guards.ts` rechaza rutas merchant para visitantes/courier. El seed no hace login al navegador.
- El formulario tiene dos botones GPS en diferentes Cards.
- `TripRouteMap` usa `AdvancedMarker` del SDK; el stub no simula explícitamente la librería marker.

### Fuente estática en este SHA

H01: `page.waitForResponse(... /api/live/available-requests ...)`, status 200, parseo de body y comprobación de 4 sentinelas.
H02: el locator `.filter({has: heading}).first()` usa div ancestro exterior.
H06: tres usos de ruta Merchant sin la sesión/rol correctos.
H07: el mock no define explícitamente `google.maps.marker.AdvancedMarkerElement`.

### No ejecutado localmente

Intento de `git ls-remote`:
```text
fatal: unable to access 'https://github.com/cadeApp/cadeApp.git/': Could not resolve host: github.com
```
No se ejecutaron mutaciones independientes: no hay forma de levantar en este contenedor el SHA ni se permite Docker/Supabase remoto. Evitar atribuir el run rojo previo al SHA actual; el E2E `37697208407` estaba in progress.

### Harness autónomo para autor / próxima revisión (NO ejecutado por esta revisión)

Guardar este script completo en `/tmp/check-298-r4.sh`, ejecutarlo solo en checkout limpio con entorno Develop autorizado. Antes de cada mutación, exigí caso base GREEN. No saltar el fail-closed, ni publicar secretos.

```bash
#!/usr/bin/env bash
set -euo pipefail
test -f e2e/specs/map-privacy.spec.ts
printf '%s\n' 'BASELINE: jamás interpretá RED si la base no queda verde'
pnpm exec playwright test e2e/specs/map-privacy.spec.ts --project=chromium --workers=1 --retries=0
printf '%s\n' 'BASELINE GREEN. Las mutaciones temporales deben usarse en memoria'
printf '%s\n' 'Mutation R1: romper guard D3/D15 de src/server/live; esperar fuga detectada en fetch.'
printf '%s\n' 'Mutation R2: invertir orden DOM de Cards y confirmar que GPS de entrega sigue seleccionado.'
printf '%s\n' 'Mutation R3: quitar marker de producción; exigir rojo por marcador pickup/dropoff.'
printf '%s\n' 'Mutation R4: dejar bypass de intercepción Google; exigir rojo por unexpected hosts.'
```

El harness solo valida baseline; las mutaciones de producción se ejecutan de forma efímera en workflow `e2e-mutation` **después de mergear la tarea**, con un patch revisado del catálogo (solo target `develop`, sin publicar código roto). No se deben fabricar pruebas rojas cambiando asserts o mocks hasta obtener el mensaje deseado.

### Comandos finales de T-314

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm exec playwright test e2e/specs/map-privacy.spec.ts --list
pnpm exec playwright test e2e/specs/map-privacy.spec.ts --project=chromium --workers=1 --retries=0
git status --short
git diff --name-only origin/develop...HEAD
git ls-remote origin feat/T-314-map-privacy
```

### Actualización: run trusted del SHA exacto 67de7f9 terminó rojo

Run `37697208407`, job `113052033584`, resultado **6 failed / 43 passed**; seis casos T-314:

```text
H01 privacy: response.text: Protocol error (Network.getResponseBody): No resource with given identifier found (spec:225).
H06 onboarding: map-picker no existe (spec:272).
H02 solicitud: strict mode violation: div.filter(has heading).first().getByRole(GPS) resolved to 2 elements (spec:371).
H07 matched: map-pin-pickup ausente (spec:418).
H06 graceful: map-load-error-banner/map-fallback ausentes (spec:486).
H06 mock: interceptedUrls.length esperaba >0, recibió 0 (spec:502).
```

La base de la próxima mutación RED **no quedó verde**. No se permite atribuir a ninguna mutación un rojo obtenido por estas fallas preexistentes; primero reparar la suite y obtener GREEN.

## Ronda 4 — SHA `0b5479059927d1f3ebdf56a85a0182ad31c1b6b1`

### Evidencia real

- CI: `37725958413`, success.
- Trusted E2E: `37726083350`, job `113144546299`, **47 passed / 2 failed**.
- Errores: `[data-testid="map-picker"]` no encontrado en alta y solicitud tras 3 intentos.
- Artifact de Playwright: `11528328239` (no se publica aquí porque las trazas pueden contener URLs/valores sensibles).
- Se inspeccionaron ambas trazas comprimidas y snapshots. Ambas capturan `TypeError: t.setDraggable is not a function` al renderizar MapPicker. El stub de `Marker` carece de ese método. En cleanup se registra también `this._listeners[name].filter` cuando el array ya no existe.
- Los snapshots de error de Next.js muestran `No pudimos cargar el alta del comercio` / `No pudimos preparar el formulario de envío`.
- El caso postmatch y el mock test pasaron, lo que permite aislar la diferencia entre `AdvancedMarkerElement` y `Marker` clásico.

### Harness independiente de contrato (script completo)

```javascript
// Copiar íntegro a /tmp/check-marker-contract.cjs. Node sin dependencias.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = process.argv[2] || 'e2e/specs/map-privacy.spec.ts';
const source = fs.readFileSync(path, 'utf8');
const start = source.indexOf('function Marker(opts) {');
const end = source.indexOf('function PinElement()', start);
assert.ok(start >= 0 && end > start, 'No se encontró Marker en el mock');
const declaration = source.slice(start, end);
const Marker = vm.runInNewContext(
  `(function(){ ${declaration}; return Marker; })()`, {}, { timeout: 1000 }
);
function probe(mutant) {
  const marker = new Marker({
    position: { lat: -27.43, lng: -65.61 }, draggable: true
  });
  if (mutant) marker.setDraggable = undefined; // Mutación solo en memoria
  try {
    assert.equal(typeof marker.setDraggable, 'function');
    marker.setDraggable(false);
    return true;
  } catch {
    return false;
  }
}
const baseline = probe(false);
const mutant = probe(true);
console.log('BASELINE Marker.setDraggable:', baseline ? 'GREEN' : 'RED');
console.log('MUTACIÓN sin Marker.setDraggable:', mutant ? 'GREEN INDEBIDO' : 'RED');
if (!baseline || mutant) process.exitCode = 1;
```

Ejecutar:
```bash
node /tmp/check-marker-contract.cjs e2e/specs/map-privacy.spec.ts
```

R4: se corrió con el archivo real extraído del archivo de trazas de Playwright `37726083350`, resultado:
```text
BASELINE Marker.setDraggable: RED
MUTACIÓN sin Marker.setDraggable: RED
exit=1
```
El control ya está rojo: no se interpretó el mutante rojo como proof de cobertura. Es un test de contrato de stub, **no** sustituto del E2E.


### Comandos integrados requeridos al autor

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm exec playwright test e2e/specs/map-privacy.spec.ts --list
pnpm exec playwright test e2e/specs/map-privacy.spec.ts --project=chromium --workers=1 --retries=0
git status --short
git diff --name-only origin/develop...HEAD
git ls-remote origin feat/T-314-map-privacy
```

En entorno local sin Supabase Develop correctamente identificado, respetar fail-closed y registrar `NO EJECUTADO`; no fabricar pruebas positivas.
