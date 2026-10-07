# Evidencia y probes — PR #298

**SHA:** `d60a0473b027db3e93145b27cb4b83bd59caf60a`

La revisión intentó clonar el repo para mutaciones runtime y recibió `Could not resolve host: github.com`. No se marca ninguna mutación como ejecutada.

## H02 · cálculo del límite

```text
start = -27.4333
step = 0.0001
minLat = -27.4800
50  -> -27.4383  dentro
467 -> -27.4800  dentro (límite inclusivo)
468 -> -27.4801  fuera
```

## H04 · tautologías

```text
unmockedGoogleRequests = 0 y no tiene escrituras
0 === 0 -> true

getInterceptedCount() >= 0:
0 >= 0  -> true
1 >= 0  -> true
99 >= 0 -> true
```

## H02 · assert condicional

```text
botón ausente + propiedad rota
=> no entra a if(isVisible())
=> 0 asserts del requisito
=> no hay rojo por esa propiedad
```

## H03 · wrapper

`trip-route-map` es el section exterior; `route-map-fallback` vive dentro de ese mismo section. Por eso `routeMap visible` pasa con mapa real y con fallback.

## Mutaciones exigidas antes de Ronda 2

- H01: respuesta same-origin textual con `-27.432`/`-65.612` → test de privacidad rojo.
- H02: quitar temporalmente alerta `isOutside` en `src/ui/map.tsx` → tests de pin rojos.
- H03: forzar `isMapAvailable=false` → test post-match rojo.
- H04: quitar mock → rojo por 0 interceptadas; disparar host Google no manejado → rojo por unexpected.

No commitear las mutaciones ni crear tests falsos/adulterados para conseguir verde.

## Comandos finales

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm exec playwright test e2e/specs/map-privacy.spec.ts --project=chromium
pnpm exec playwright test e2e/specs/map-privacy.spec.ts --list
node docs/revision-pr/analizar.mjs verificacion
git status --short
git ls-remote origin feat/T-314-map-privacy
```
