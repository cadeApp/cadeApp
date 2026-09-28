# Comandos reproducibles — PR #117 / R1

SHA inspeccionado: `f661f372e0cc708759caf91816b3483d31883f69`.

> R1 fue estática por tener bloqueantes. Esta batería queda preparada para que R2 la ejecute sobre el SHA corregido. Las mutaciones deben hacerse en memoria o sobre una copia temporal; no se aceptan tests falsos ni expectativas debilitadas para obtener verde.

## Precondición · sincronización

```bash
git fetch origin
git switch feat/T-201-pwa-manifest-sw
git pull --ff-only
git merge origin/develop
git status --short
```

Sin rebase, sin amend, sin force-push.

## H01 · T03 sobre componentes reales

Primero, el test dirigido:

```bash
pnpm vitest run src/features/offers/courier-panel.test.tsx src/features/notifications/offline/offline-state.test.tsx
```

Expectativas obligatorias en `courier-panel.test.tsx`:

- `navigator.onLine=false` o evento `offline` → contenedor real del feed contiene `grayscale-[20%]` + `opacity-80`;
- botón real **Ofertar** está disabled;
- abrir el Sheet online, disparar `offline`, y comprobar **Enviar oferta** disabled;
- intentar submit offline deja el spy de `onSubmitOffer` en 0 llamadas;
- evento `online` rehabilita.

Mutación RED propia de R2: sobre una copia temporal del archivo productivo o una transformación en memoria, eliminar la guarda offline / forzar `isOffline=false` y comprobar que el test falla. No usar el botón artificial de `TestConsumer` como evidencia.

## H02 · ejecutar el `public/sw.js` real

El test debe leer el runtime real:

```ts
const source = fs.readFileSync(path.resolve(process.cwd(), 'public/sw.js'), 'utf8');
vm.runInNewContext(source, sandbox);
```

El sandbox debe mockear:

- `self.location.origin = 'https://cadeapp.ar'`;
- `self.addEventListener` guardando listeners `install/activate/fetch`;
- `self.skipWaiting`, `self.clients.claim`;
- `caches.open/keys/delete/match`;
- cache con `addAll/match/put`;
- `fetch`, `Request`, `Response`, `URL`, `Promise`.

Casos:

```text
GET https://cadeapp.ar/brand/logo.svg                -> persistible
GET https://cadeapp.ar/_next/static/chunks/app.js   -> persistible
GET https://cadeapp.ar/api/health                    -> NO interceptar/persistir
GET https://cadeapp.ar/api/requests                  -> NO interceptar/persistir
GET https://cadeapp.ar/courier/feed (navigate, red OK) -> responder red; cache.put = 0
GET https://cadeapp.ar/courier/feed (navigate, red KO) -> fallback cache '/'
GET https://maps.googleapis.com/...                  -> NO interceptar
POST/PUT/DELETE                                      -> NO interceptar
```

Comando:

```bash
pnpm vitest run src/app/sw.test.ts
```

Mutación RED: ampliar **en memoria** la condición de persistencia a todo GET y volver a ejecutar los mismos casos. Debe fallar `/api/health` o la navegación autenticada.

## H03 · piso tipográfico y target Retry

Control dirigido:

```bash
grep -nE 'text-xs|\bh-9\b' \
  src/features/notifications/install/ios-install-guide-sheet.tsx \
  src/features/notifications/offline/offline-banner.tsx \
  src/features/notifications/offline/error-view.tsx
```

Resultado esperado: sin `text-xs`; Retry usa `h-12` o `min-h-12`.

Tests:

```bash
pnpm vitest run \
  src/features/notifications/install/ios-install-guide.test.tsx \
  src/features/notifications/offline/visual-verification.test.tsx
```

Mutación RED: cambiar temporalmente Retry a `h-9` o una ocurrencia controlada a `text-xs`; la aserción específica debe ponerse roja.

## H04 · navegador/capturas

No usar `window.innerWidth` en jsdom como prueba de layout.

Con build productivo:

```bash
pnpm build
pnpm start
```

Verificar en navegador real:
- 390×844 y 360×800;
- T01 Sheet iOS;
- T03 offline sobre `CourierFeed` real;
- T04 error y 404;
- foco, safe area y reduced motion.

Las capturas deben ser persistentes y quedar enlazadas en PR + bitácora. Si el entorno no puede subirlas, dejar el DoD abierto: no inventar enlaces ni marcarlo como verificado.

## H05 · rollback

Corregir solo el cuerpo de la PR. No hace falta tocar código para cerrar H05.

El texto debe dejar de afirmar que 404 elimina la registración y explicar que, si se retira la PWA, una registración existente requiere `ServiceWorkerRegistration.unregister()` o un kill-worker explícito.

## Batería final después de los dirigidos

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
node docs/revision-pr/analizar.mjs verificacion
git status --short
```

En la bitácora pegar resúmenes RED/GREEN de los tests dirigidos y los resultados finales. No escribir “verificado”: esa palabra queda para la revisión independiente.
