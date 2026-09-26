# PR #83 · T-115 — Ronda 5 independiente

- **SHA revisado:** `2f9cf91fb6f9534b8d60e6f716a6d607239f6dc3`
- **Resultado:** **CON BLOQUEANTES (2)**
- **Decisiones pendientes:** ninguna.
- **CI #423:** todos los jobs verdes: build, unit, audit, db-tests, typecheck, lint y bundle-budget.
- **Unit #423:** 60 archivos / 671 tests.
- **Advertencia:** #423 fue `pull_request` contra base SHA `6ac32e77…`, no contra el develop actual.

## Preflight

- Agy no volvió a tocar `docs/revision-pr/pr-83/**` después de la Ronda 4.
- Desde `86229cba` hasta el head final solo cambió una línea de `docs/tasks/log/T-115.md`.
- La ampliación de ficha `src/app/trips/**` sigue respaldada por D02 de Lautaro073.
- CC-008 y CC-009 están mergeadas y consumidas.
- No apareció ninguna 🔵 DECISIÓN nueva.

## H05 · CERRADO Y VERIFICADO

La bitácora conserva rojo/verde concreto y los controles existen en el SHA actual.

Reproducción independiente aislada:

```text
H14 teléfono:
actual courier=5493865111111 -> assertion GREEN
mutado recipient=5493865123456 -> assertion RED

H13 delegación:
actual {requestId} -> exact input GREEN
mutado {requestId: requestId+"-mutated"} -> exact input RED

H19 semántica:
actual role=alertdialog -> GREEN
mutado generic Dialog role=dialog -> RED
```

Además el source actual confirma:
- C06 construye el enlace con `trip.courierPhone`;
- `queries.ts` invoca exactamente `getTripDetailsServer({ requestId })`;
- T05 importa `@/ui/alert-dialog`;
- los tests actuales afirman esas tres propiedades.

H05 pasa a `arreglado-verificado`.

## H20 · BLOQUEANTE — la evidencia no cumple “app corriendo”

La directiva vinculante dice:

> verificar la pantalla en navegador real **con la app corriendo**, a 390 y 360 px.

La evidencia actual no hace eso. `render-previews.test.tsx`:

1. usa `ReactDOMServer.renderToString`;
2. escribe HTML estático en `src/features/trips/evidence/T-115/`;
3. monta `<TripMerchantView trip={baseTrip} />` sin handlers;
4. monta `<TripCourierView trip={baseTrip} />` sin `onAdvanceTrip` ni `onCancelTrip`.

Resultado visible de la inspección de las seis PNG:

- C06 390/360: layout estable, pero no aparecen “El repartidor no llegó” ni “Cancelar envío” porque la preview no pasa handlers.
- R07 390/360: layout estable, pero **“Marcar como retirado” aparece disabled** en ambas capturas.
- T05 390/360: modal legible, targets amplios y sin overflow aparente.

La ruta real sí pasa los handlers mediante `TripMerchantContainer` y `TripCourierContainer`; por eso esto es un defecto de evidencia, no un bug funcional del producto.

Además el unit job #423 ejecuta `render-previews.test.tsx` y escribe HTML de evidencia durante la suite, por lo que el test no es hermético.

### Corrección exacta H20

1. Eliminá `src/features/trips/render-previews.test.tsx`.
2. Eliminá los tres HTML estáticos:
   - `evidence/T-115/c06-merchant.html`
   - `evidence/T-115/r07-courier.html`
   - `evidence/T-115/t05-cancel-dialog.html`
3. Levantá la **app real** (`pnpm dev` o build+start) con datos locales autorizados.
4. Entrá por la ruta real `/trips/<requestId>`:
   - merchant matched: C06 debe mostrar WhatsApp/Llamar al cadete **y** “El repartidor no llegó” + “Cancelar envío”;
   - courier matched: R07 debe mostrar WhatsApp/Llamar al comercio y **“Marcar como retirado” habilitado**;
   - abrí T05 desde la pantalla real para la captura del diálogo si querés conservarla.
5. Capturá C06 y R07 en 390×844 y 360×800 desde la app corriendo. Reemplazá las PNG actuales.
6. Verificá en navegador: sin overflow horizontal, foco visible, targets 48/56, sticky CTA, scroll y copy.
7. Actualizá PR/bitácora diciendo “captura de ruta real”, no preview estática.

No inventes un fixture HTML nuevo para evitar la autenticación/ruta real.

## H25 · BLOQUEANTE — develop avanzó 2 commits

`develop` actual:

```text
bdafee8f [CC-010] Primitivas shadcn Table, Tabs e InputOTP
366a2b85 [T-106] Migración, RLS de coordenadas y RPC calculate_route_distance
6ac32e77 [CC-009]
```

La rama de T-115 está `behind 2`.

El CI #423 terminó verde, pero la metadata del workflow dice:

```text
event: pull_request
head: 2f9cf91f...
base: 6ac32e77...
```

Por lo tanto no certifica el develop actual. Los dos commits nuevos tocan dependencias/tipos/UI compartidos (`package.json`, `src/types/database.types.ts`, `src/ui/index.ts`, etc.), aunque no toquen archivos propios de T-115.

### Corrección exacta H25

```bash
git fetch origin
git checkout feat/T-115-vista-de-viaje
git pull --ff-only origin feat/T-115-vista-de-viaje
git merge origin/develop
```

- **sin rebase**
- **sin force**
- **sin amend**

Después:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
git diff --check
git status --short
git push origin feat/T-115-vista-de-viaje
git ls-remote origin feat/T-115-vista-de-viaje
```

La próxima revisión debe ver `behind 0` y un CI nuevo posterior a ese merge.

## Otros cierres de Ronda 4

Por inspección actual + CI:
- H13: wrapper CC-008 real.
- H14: teléfonos por participante + avatar/builder correctos.
- H19: AlertDialog/tokens de CC-009.
- H22: no reincidió la autoedición de la carpeta de revisión.
- H23: body actualizado.
- H24: sin non-null assertions.
- H10: pending/foco/empty integrados.
- H06: bitácora final distingue correctamente el SHA de evidencia.

## Dictamen

No está lista para merge todavía.

Quedan únicamente **H20 + H25**. No hace falta tocar lógica de negocio ni volver a trabajar CC-008/009.
