# Evidencia — PR #253 — Ronda 1

## Estado
~~~text
SHA revisado: 0dc814cf1e240f50bc3c9add370ac924866c39cc
develop: 1cd3da01b3af9619e4a19107ba5e8354a18c2159
compare: ahead 2 / behind 1
~~~

## Pruebas estáticas
- axe: loader recorre `node_modules/.pnpm`; package no declara axe; lock trae `axe-core@4.13.0` vía `eslint-plugin-jsx-a11y`.
- auth: merchant y courier usan la misma page; el guard redirige `/login` cuando hay sesión.
- trip: seed base = `published`; CC-008 exige `matched|in_transit|delivered` y oferta aceptada.
- storage: courier = INSERT; admin = ALL. El spec no elimina el objeto creado.
- a11y: tags actuales llegan a `wcag21aa`; regla del proyecto = WCAG 2.2 AA.
- evidencia: RED declarado = fail-closed del entorno; test declarado = verify-fichas 7/7, no `pnpm test`.

## Ejecución independiente
~~~text
git clone --branch feat/T-309-uploads-a11y --single-branch https://github.com/cadeApp/cadeApp.git
fatal: Could not resolve host: github.com
~~~
No se presentan checks locales como ejecutados. CI no se inspecciona para cierre con bloqueantes.


---

# Ronda 2 — evidencia sobre 64f5b9153a5614ba2920e622857db18910137a42

## Estado remoto
~~~text
PR Draft: true
mergeable: true
develop...branch: ahead 11 / behind 0
diff actual: 10 archivos, todos dentro de T-309/revisión
~~~

## Cerrados
- H01: dependency explícita 4.13.0 + AxeBuilder.
- H03: sesiones ya no se reutilizan.
- H04: seed matched con courier asignado.
- H05: tags 2.0/2.1/2.2 A/AA.

## H02 residual
`DocumentUploadCard` pone el filename dentro de `role=status` al quedar success. El spec busca:
~~~text
getByRole('status').filter({ hasText: /cargado/i })
~~~
El texto “Cargado” está en otro span sin role=status.

T-337 registra además que `getByRole('alert')` sin filtro encuentra también el next-route-announcer.

## H09 — baseURL perdido
Config:
~~~text
use.baseURL = PLAYWRIGHT_TEST_BASE_URL || https://cadeapp-staging.vercel.app
use.contextOptions.reducedMotion = reduce
~~~
Spec:
~~~text
browser.newContext()
browser.newContext()
browser.newContext()
~~~
Los contextos manuales no reciben esas opciones y luego navegan con rutas relativas.

## H10 — non-null
~~~text
const parsedDocs = JSON.parse(rawDocs!);
~~~
AGENTS §4 prohíbe `! non-null`.

## H11 — JPEG truncado
Probe:
~~~text
Buffer.from(base64,'base64').subarray(-2).toString('hex')
=> 3f10
~~~
EOI JPEG esperado: `ffd9`.

`compressImage` usa `new Image()` y rechaza en `img.onerror` antes de llamar a Storage.

## H12 — rechazo por razón equivocada
~~~text
/mime type not allowed|mime type|invalid|violates/i
~~~
`violates` permite que una rotura RLS pase por “archivo inválido”.

## H06 — cleanup
El path se obtiene recién después del success locator + sessionStorage + JSON.parse. Si el objeto ya se creó y cualquiera de esos pasos falla, finally no recibe path.

## H07
Bitácora conserva salida concreta solo para quitar tags WCAG 2.2. Las demás mutaciones no incluyen fallo/exit code reproducible.

## H08
`package.json`:
~~~text
test = vitest run && workflow tests && ADR tests
~~~
Bitácora R2 registra esos componentes por separado, pero no `pnpm test` literal.

## CI
No inspeccionado como cierre por existir bloqueantes.


---

# Ronda 3 — evidencia sobre d7b7f40a80d8619ad126df6369ddaa8e45f9ad10

## Estado
~~~text
develop = 6e2da8fb02d4797b9add222206342e6055f1d81c
HEAD    = d7b7f40a80d8619ad126df6369ddaa8e45f9ad10
compare = ahead 19 / behind 2
PR Draft = true
mergeable = true
~~~

El diff actual contra develop contiene solo T-309 + docs/revision-pr/pr-253/**.

## Cerrados
H02, H06, H09, H10, H11 y H12 se revalidaron por inspección.

### PNG
Probe independiente del Base64:
~~~text
format = PNG
size = (2, 2)
mode = RGB
load() = OK
~~~

### Cleanup
El POST exitoso captura path antes de continue; finally elimina y lista el folder para comprobar ausencia.

### Contextos
No quedan browser.newContext() manuales. Las páginas de a11y usan fixture page.

## H07 pendiente
Bitácora R3 contiene RED concreto para:
- tags 2.2;
- image-alt en login;
- URL canónica incorrecta.

Falta evidencia de:
- retry roto;
- selector roto;
- MIME permitido;
- image-alt en crear solicitud;
- image-alt en feed;
- image-alt en viaje;
- image-alt en onboarding.

## H08 pendiente
~~~text
pnpm test -> exit 1
117 test files passed
2 test files failed
~~~

La alternativa serial 119/119 no reemplaza al comando del DoD.

En develop actual, cc007.test.ts crea un git worktree temporal para sus mutaciones:
~~~text
git worktree add --detach <tmp> HEAD
~~~
y documenta que así no contamina otros tests paralelos.

La rama está 2 commits detrás de ese develop; debe sincronizar y reintentar el comando exacto.

## CI
No inspeccionado como evidencia de cierre porque H07/H08 siguen bloqueantes.


---

# Ronda 4 — evidencia

SHA funcional revisado: `f3d783ba44c5cbe15f8b5c2485a18d91a93d202d`.

## H07 — RED remoto

### M1
- commit: `c8a90db0dc1573894461030f8ce4ea876cfdad09`
- run: `37548183777`
- job: `112557207995`
- resultado: failure esperado.
- 7 tests T-309 fallan por las mutaciones prescritas: retry, MIME y las 5 superficies axe.
- revert: `76c086bb7f638aa7bd0989e6efbe6a162fa19fff`.

### M2
- commit: `ee571ff71a37485f17f149443723676960edce3a`
- run: `37550262717`
- job: `112563834547`
- resultado: failure esperado.
- error exacto: `getByLabel(/selector-inexistente-t309/i)` no se adjunta.
- revert: `8cd5eb33cfd485078c30582db566870651a9e050`.

## H08 y CI exact-head

Bitácora:
~~~text
pnpm typecheck -> exit 0
pnpm lint      -> exit 0
pnpm test      -> exit 0
121/121 test files
1921/1921 tests
57 workflow tests
6 ADR tests
~~~

Run CI `37554842296`:
~~~text
typecheck     success
lint          success
unit          success
build         success
db-tests      success
audit         success
bundle-budget success
~~~

Vercel: success.

## e2e-preview exact-head

Run `37554952589`, job `112578994444`:
~~~text
43 passed
2 failed
- axe AA en viaje
- axe AA en onboarding
exit 1
~~~

Viaje:
~~~text
aria-hidden-focus
<div tabindex="0" aria-hidden="true"></div>

color-contrast
fg #09babd
bg #f1f9f8
ratio 2.24
expected 4.5:1
~~~

Onboarding:
~~~text
color-contrast
fg #09babd
bg #f3fcfc -> 2.29
bg #ffffff -> 2.39
expected 4.5:1
~~~

## Prueba de preexistencia

Rama y develop tienen los mismos blobs:
~~~text
trip-courier-view.tsx  32e189c15cac0f5d2dbfb3cec533d77c5806ebce
trip-route-map.tsx     b98cf080172c60db5633b0d41d2c07b186480b3a
document-upload-card   26ca248d2898a4e363ed687129617d14c32828de
~~~

No son regresiones de T-309.

Issues abiertos por la revisión:
- #296
- #297

T-205 / #32 ya tiene alcance para `src/features/trips/**` y `src/features/courier-onboarding/**` y exige axe AA sin violaciones.
