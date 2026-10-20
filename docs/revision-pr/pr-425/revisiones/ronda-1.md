# Informe de revisión — PR #425 / T-373

**PR:** https://github.com/cadeApp/cadeApp/pull/425  
**Head de implementación revisado:** `8e9ada09b10cbd38ab684909b62fab2c337c167d`  
**Head documental al iniciar:** `8f2c51fcd3a4df1f1305141a5b5ab21c15453924`  
**Base:** `develop` @ `9f1d1a6f335915b723d6fe98763990d3097706f4`  
**Fecha:** 2026-10-19

## Cómo leer este informe

Cada hallazgo separa diagnóstico, evidencia ejecutada y corrección requerida. No se aprueba ni se mergea la PR. La implementación funcional se evaluó en `8e9ada09`; `8f2c51f` solo agrega ficha y bitácora.

## Resumen por prioridad

| # | Severidad | Archivo | Problema | Tipo |
|---|---|---|---|---|
| PR425-A01 | BLOQUEANTE · alto | `src/app/(admin)/admin/incidents/_tests/trip-report-wiring.test.tsx:16` y `src/app/(merchant)/merchant/requests/[id]/page.test.tsx:37` | La ampliación 5-B no existe en la ficha canónica de `origin/develop` | alcance |
| PR425-H01 | BLOQUEANTE · alto | `e2e/specs/t373-courier-cancellation-history.spec.ts:21` | Solo hay una cancelación y la inversión del orden visible no rompe tests | cobertura/DoD |

## 1. 🔴 PR425-A01 — Dos tests están fuera del alcance autorizado

**Archivos:** `src/app/(admin)/admin/incidents/_tests/trip-report-wiring.test.tsx:16` y `src/app/(merchant)/merchant/requests/[id]/page.test.tsx:37`  
**Estado:** `[ANÁLISIS]` · abierto

### Diagnóstico

La ficha canónica en `origin/develop` autoriza `src/app/trips/[id]/page.tsx` y `src/app/(merchant)/merchant/requests/[id]/page.tsx`, «sólo esos entrypoints». No autoriza ninguno de los dos tests modificados. La decisión 5-B aparece recién en la rama de la propia PR, por lo que no puede ampliar retroactivamente el alcance: la regla 00 establece que la ficha solo cambia por un PR aprobado en `develop`.

### Evidencia

- `git diff --name-status origin/develop...8e9ada09` incluye ambos tests.
- `origin/develop:docs/tasks/T-373.md:51-56` no los incluye y limita la zona de `src/app` a los dos `page.tsx`.
- El cuerpo y la bitácora declaran 5-B, pero son datos de la rama revisada, no la fuente canónica.

### Arreglo requerido

No inventar una excepción técnica. Lautaro073 debe elegir una de estas vías antes de la ronda 2:

1. autorizar explícitamente las dos rutas en la ficha mediante un cambio que llegue a `develop` y luego rebasear esta rama; o
2. retirar ambos cambios y mantener las suites verdes con una solución que use únicamente archivos ya permitidos.

No ampliar el mock a más archivos ni convertir esta PR en un cambio contractual.

### RED y verificación

- RED de alcance: `git diff --name-only origin/develop...HEAD` debe seguir mostrando las dos rutas mientras la ficha canónica no las autorice.
- GREEN: repetir la comparación contra el nuevo `origin/develop`; cada ruta del diff debe estar autorizada. Luego correr los dos archivos de Vitest afectados y la batería general.

## 2. 🔴 PR425-H01 — Falta el caso de dos cancelaciones y el orden visible no está protegido

**Archivo:** `e2e/specs/t373-courier-cancellation-history.spec.ts:21`  
**Estado:** `[VERIFICADO-RUNTIME]` · abierto

### Diagnóstico

El DoD de T-373 exige dos cancelaciones de asignación, rematch, eventos distintos correctamente ordenados y una prueba sensible al orden/empates. El E2E crea solo la cancelación de A y luego acepta la oferta de B; todos sus oráculos de cronología esperan exactamente un elemento. Los tests de componente pasan dos eventos en un caso, pero solo afirman la cantidad.

### Evidencia

- E2E: `toHaveCount(1)` en líneas 72, 96, 120 y 135; B nunca cancela.
- Mutación independiente: se cambió temporalmente `events.map(...)` por `[...events].reverse().map(...)` en `CancellationHistoryList`.
- Resultado: `pnpm exec vitest run src/features/trips/cancellation-history.test.tsx` continuó verde con 1 archivo y 11 tests.
- Se restauró exactamente el archivo; `git diff --exit-code` quedó limpio.

### Riesgo

Una regresión que invierta la cronología visible puede pasar unit, CI y el E2E actual. Además, el caso durable de dos asignaciones canceladas nunca atraviesa la UI real, por lo que el checkbox del DoD está marcado sin evidencia suficiente.

### Arreglo requerido

Extender el flujo con dos repartidores:

1. A ofrece, es aceptado y cancela.
2. B ofrece, es aceptado y cancela con otra categoría.
3. A crea una oferta nueva —distinta de su oferta terminal— y se realiza el rematch.
4. El comercio ve dos eventos en orden más reciente primero y con actores/categorías distinguibles.
5. A ve solo su evento; B ve solo el suyo; un actor sin evento no ve ninguno.
6. Agregar una aserción de componente que compare el orden de los `listitem`, no solo su cantidad. Incluir un caso de empate o conservar la cobertura de desempate verificable de CC-032 y enlazarla explícitamente.

### RED y verificación

- RED requerido: repetir la mutación de inversión; el test nuevo debe fallar por orden. También demostrar que eliminar una de las dos cancelaciones rompe el E2E.
- GREEN: `pnpm exec vitest run src/features/trips/cancellation-history.test.tsx` y E2E Preview del spec T-373 sobre el SHA corregido; después ejecutar la batería completa.

## NO TOCAR — falsos positivos descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| La UI filtra permisos en el navegador | No: todas las lecturas pasan por `get_request_cancellation_history` con cliente de sesión; la RPC autoriza y filtra por actor. |
| Se expone `rawReason` | La lista nunca lo renderiza y CC-032 lo fuerza a `null` para comercio/repartidor; la mutación declarada por el autor y el test unitario protegen el render. |
| La cancelación convierte el pedido en `cancelled` | El E2E comprueba `published` y la UI usa copy explícito de asignación, no de cancelación definitiva. |
| Hay N+1 | La primera página usa una RPC y cada acción «Ver más» usa una RPC keyset; no hay consulta por evento. |
| CC-032 no está desplegado | PR #424 se mergeó como `9f1d1a6f`; el workflow `migrate` 39208629564 terminó verde en Develop. |

## Por qué los checks verdes no alcanzan

| Check | Qué dice | Qué no ejerce |
|---|---|---|
| typecheck/lint/build | Tipos, reglas y compilación correctos | Alcance autorizado y DoD de dos eventos |
| unit | 148 archivos / 2867 pruebas verdes | La mutación de invertir eventos siguió verde |
| db-tests | RPC/RLS/orden SQL de CC-032 verdes | Orden renderizado por React y doble cancelación en la pantalla |
| E2E de `8e9ada09` | 91 Chromium + 6 global-settings verdes | Solo una cancelación y un único evento visible |
| approval-policy | Rojo | Espera el informe; no valida por sí mismo la corrección funcional |

## Checklist de verificación final

- [x] Diff completo y 23 archivos inspeccionados.
- [x] CC-032 mergeado y checkpoint de Develop verificado.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test` y suites dirigidas ejecutados localmente.
- [x] Mutación de orden ejecutada y restaurada.
- [ ] Alcance reconciliado con `origin/develop`.
- [ ] Dos cancelaciones, aislamiento y orden visibles protegidos por RED/GREEN.
- [ ] Nuevo SHA revalidado en ronda 2.

## Metodología

Revisión independiente sobre worktree aislado. No se modificó la implementación ni se usaron secretos. `pnpm test:db` se intentó, pero el Supabase local no estaba iniciado (`ECONNREFUSED 127.0.0.1:54322`); se registra como no disponible localmente. El job `db-tests` del SHA exacto sí pasó en CI. La mutación temporal fue restaurada y el árbol quedó limpio antes de crear estos artefactos.
