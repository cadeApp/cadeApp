# Informe de revisión — PR #425 / T-373 — ronda 3

**PR:** https://github.com/cadeApp/cadeApp/pull/425
**Head de implementación revisado:** `9ab27a099e36d4abf0c4dae5716d32d0ead88edb`
**Head documental al iniciar:** `e9c599f41274c7b1e54b4c2467c5bae241fae9bb`
**Base:** `develop` @ `9f1d1a6f335915b723d6fe98763990d3097706f4`
**Fecha:** 2026-10-19

## Resultado

**CON BLOQUEANTES (1).** PR425-H02 y PR425-H03 quedaron corregidos y verificados con mutaciones independientes. La
ronda detectó PR425-H04: la segunda lectura paralela, el historial, todavía convierte un fallo interno en ausencia.

## Resumen por prioridad

| # | Severidad | Archivo | Problema | Tipo |
|---|---|---|---|---|
| PR425-H04 | BLOQUEANTE · alto | `src/app/trips/[id]/page.tsx:23` | `INTERNAL_ERROR` del historial llama `notFound()` para el repartidor histórico | correctness / error state |

## Verificación de hallazgos de ronda 2

### PR425-H02 — arreglado-verificado

- `getTripDetails` lanza `TripDetailsUnavailableError` solo ante `INTERNAL_ERROR`; los códigos de ausencia/estado
  conservan `null`.
- En el `Promise.all` real de la página, ese rechazo llega al `error.tsx` y ya no permite elegir la vista cancelada.
- Mutación independiente `throw` → `return null`: 2 fallos / 31 éxitos. Restaurado: 33/33 y SHA-256 exacto
  `3CA79E78925AECFF3B008A8CBED84C4988391600764E1B11DD60DD3ED190D939`.

### PR425-H03 — arreglado-verificado

- `/merchant/requests/[id]` resuelve y clasifica el pedido antes de cargar historial.
- `draft`, `matched`, `in_transit` y `delivered` invocan cero veces la RPC; `published`, `cancelled` y `expired`, una.
- Mutación independiente que quitó la guarda: 4 fallos / 29 éxitos. Restaurado: 33/33 con el mismo hash exacto.
- Residual no bloqueante: los estados que sí muestran historial lo cargan después del detalle. Es una dependencia
  condicional deliberada que evita lecturas descartadas; no hay N+1.

## PR425-H04 — un fallo interno del historial se convierte en 404

**Archivo:** `src/app/trips/[id]/page.tsx:22-24`
**Estado:** `[VERIFICADO]` · abierto

### Diagnóstico

`renderCourierCancelledAssignment` llama `notFound()` ante cualquier `!history.ok`. Eso es correcto para `NOT_FOUND`,
porque no se debe confirmar que el pedido o eventos ajenos existen. No es correcto para `INTERNAL_ERROR`: un courier
que sí tiene una cancelación histórica puede recibir «Viaje no encontrado» durante una falla operativa de la RPC.

El arreglo de H02 preserva la diferencia para el detalle, pero la otra rama del mismo `Promise.all` todavía pierde esa
diferencia en el consumidor. La ruta ya tiene `error.tsx`, así que existe un estado honesto y accesible disponible.

### Evidencia reproducible

Se agregó temporalmente una prueba reviewer-owned al consumidor real con:

- perfil `courier` autenticado;
- `getTripDetails` retornando `null`;
- `getRequestCancellationHistoryServer` retornando `{ ok: false, code: 'INTERNAL_ERROR' }`;
- oráculo `expect(notFound).not.toHaveBeenCalled()`.

Resultado: RED, 1 fallo; `notFound` fue llamado exactamente una vez. El archivo temporal se restauró al SHA-256
`5DB3125D57E7024E3865357E2DBC0D3F0D1DEBA1375B7CCD3F5CF5C630BC88E3` y el árbol quedó limpio.

### Riesgo

La persona interpreta una falla transitoria como inexistencia o falta de participación, pierde la posibilidad de
reintentar desde el estado de error y el sistema oculta un problema operativo real bajo un 404.

### Arreglo requerido

Hacer que el fallback distinga códigos. `NOT_FOUND` y ausencia legítima conservan el 404 sin revelar información;
`INTERNAL_ERROR` debe lanzar un error sanitizado hacia `src/app/trips/[id]/error.tsx` o renderizar un estado de error
explícito. No exponer ids, payloads ni mensajes de PostgreSQL.

### RED/GREEN requerido

Extraer dentro de `src/features/trips/**` la decisión tipada que usa la página y probarla allí, sin volver a modificar
los tests de página fuera de alcance. Cubrir al menos:

1. `trip = null` + historial `NOT_FOUND` → 404.
2. `trip = null` + historial `INTERNAL_ERROR` → no 404; error boundary/estado explícito.
3. `trip = null` + historial propio con eventos → `CourierCancelledAssignmentView`.
4. viaje actual válido + historial `INTERNAL_ERROR` → el detalle sigue visible con la tarjeta de error, si esa sigue
   siendo la política elegida para actores actualmente asignados.

La prueba debe caer al mutar nuevamente el branch de `INTERNAL_ERROR` a `notFound()`.

## NO TOCAR — falsos positivos descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| H02 lanza desde una server action | `getTripDetails` es una query de Server Component, no una server action; el segmento ya tiene `error.tsx`. |
| H03 introduce N+1 | Hace como máximo una lectura histórica por render y cero en cuatro estados; no itera filas. |
| Los códigos esperados del detalle deben lanzar | La página usa `null` para ausencia/estado no visible y conserva el 404/fallback autorizado; solo `INTERNAL_ERROR` es falla operativa. |
| Se expone texto libre o PII | La RPC sigue filtrando por actor y fuerza `rawReason = null` para merchant/courier; no cambió el contrato. |

## Checks y evidencia

- Local: typecheck ✅; lint ✅; test ✅ (148 archivos / 2882 pruebas); workflows 79/79 y ADR 6/6.
- Dirigidas: 12 archivos / 248 pruebas ✅; `queries.test.ts` restaurado 33/33.
- `pnpm test:db`: no disponible localmente (`ECONNREFUSED 127.0.0.1:54322`); job oficial db-tests ✅.
- CI de `9ab27a09`: unit/typecheck/lint/build/audit/bundle-budget/db-tests ✅.
- E2E oficial: run 39245994799 ✅; status publicado sobre `9ab27a09`, 91 Chromium + 6 global-settings; T-373
  pasó en 47.4 s.
- `approval-policy` permanece rojo porque el informe del autor todavía no refleja el bloqueo de esta ronda.

## Metodología

Revisión independiente en worktree aislado, sin secretos ni cambios de implementación. Se inspeccionó el diff completo,
contratos, reglas y evidencia remota; las tres mutaciones/pruebas temporales se restauraron a hashes exactos antes de
editar únicamente los artefactos de revisión.
