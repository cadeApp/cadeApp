# Informe de revisión — PR #425 / T-373 — ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/425
**Head de implementación revisado:** `2c38dad51bb473cf62e72b0bf6af7f5049f71b1f`
**Head documental al iniciar:** `e1fa4748a662cc623c58866f0c350d084c287562`
**Base:** `develop` @ `9f1d1a6f335915b723d6fe98763990d3097706f4`
**Fecha:** 2026-10-19

## Resultado

**CON BLOQUEANTES (1).** PR425-A01 y PR425-H01 quedaron corregidos y verificados de forma independiente. La ronda
detectó PR425-H02 en la decisión de fallback del detalle del repartidor. PR425-H03 es una mejora de eficiencia.

## Resumen por prioridad

| # | Severidad | Archivo | Problema | Tipo |
|---|---|---|---|---|
| PR425-H02 | BLOQUEANTE · alto | `src/app/trips/[id]/page.tsx:61` | Cualquier fallo de `get_trip_details` puede terminar mostrando «Cancelaste esta asignación» si el historial sí responde | correctness / estado |
| PR425-H03 | MEJORA · bajo | `src/app/(merchant)/merchant/requests/[id]/page.tsx:27` | Se consulta el historial aun para draft y estados que redirigen, y matched lo vuelve a consultar en `/trips/[id]` | efficiency |

## Verificación de hallazgos de ronda 1

### PR425-A01 — arreglado-verificado

- Los dos tests fuera de alcance son idénticos a `origin/develop`.
- `git diff --name-status origin/develop...2c38dad5` contiene únicamente rutas autorizadas por T-373, además de los
  artefactos exclusivos de revisión.
- Los tests dirigidos pasaron: 4 archivos, 101 pruebas.

### PR425-H01 — arreglado-verificado

- El E2E contiene dos cancelaciones reales, categorías distintas, oferta terminal rechazada, oferta nueva para el
  rematch, orden B→A para el comercio, aislamiento de A/B y 404 para un tercer repartidor.
- El E2E oficial del SHA exacto está verde: run 39236284518, 91 Chromium y 6 global-settings.
- Mutación independiente: invertir `events` produjo 1 fallo / 10 éxitos en
  `cancellation-history.test.tsx`; restaurado produjo 11/11 y el hash volvió exactamente al original.

## PR425-H02 — un fallo interno se presenta como una cancelación válida

**Archivo:** `src/app/trips/[id]/page.tsx:56-62`
**Estado:** `[ANÁLISIS]` · abierto

### Diagnóstico

`getTripDetails()` devuelve `null` para cualquier error de `get_trip_details`, incluidos `NOT_FOUND`,
`INVALID_STATE_TRANSITION`, `UNAUTHORIZED_ACTOR` e `INTERNAL_ERROR`. La página interpreta todo `null` del mismo modo:
si el usuario es courier y la RPC histórica responde con eventos propios, renderiza `CourierCancelledAssignmentView`.

Esto es incorrecto para un repartidor que canceló antes y después fue reasignado al mismo pedido: ante una falla
transitoria, un error al firmar el avatar o cualquier `INTERNAL_ERROR` del detalle actual, el historial puede seguir
respondiendo y la UI le afirma «Cancelaste esta asignación», aunque exista un viaje activo que no pudo cargarse. Se
confunde un error de lectura con el estado del viaje, justo lo que T-373 exige evitar.

### Evidencia

- `src/features/trips/queries.ts:14-16` colapsa `!result.ok` a `null`.
- `src/server/rpc/trips.ts:21-30,55-83` distingue y produce `INTERNAL_ERROR`, además de los códigos del contrato.
- `src/app/trips/[id]/page.tsx:60-62` no puede conocer el motivo del `null` y usa el historial como fallback válido.
- La prueba actual `queries.test.ts:144-152` incluso consagra que cualquier error retorna `null`; no existe un caso que
  combine un viaje activo con `INTERNAL_ERROR` y un historial previo exitoso.

### Riesgo

Estado falso para el repartidor, posible ocultamiento de un viaje vigente y acciones operativas equivocadas. El
historial es válido, pero no autoriza a concluir que el detalle actual no existe cuando la lectura falló.

### Arreglo requerido

Conservar el resultado tipado de `get_trip_details` hasta la página o introducir un loader de feature que distinga los
códigos. Renderizar la vista histórica solamente para los códigos/estados esperados tras una cancelación o cuando el
detalle realmente no es visible; `INTERNAL_ERROR` debe llegar al `error.tsx` (o a un estado de error explícito) y nunca
convertirse en «Cancelaste esta asignación». Mantener toda la lógica y sus tests dentro de los archivos permitidos de
`src/features/trips/**` y el entrypoint autorizado.

### RED/GREEN requerido

Agregar en `src/features/trips/**` una prueba donde `get_trip_details` retorna `INTERNAL_ERROR` y el historial retorna
un evento propio: antes del arreglo debe demostrar que la decisión actual escogería la vista cancelada; después debe
demostrar que se propaga el error. Cubrir también el caso legítimo post-cancelación y el rematch exitoso. Ejecutar las
suites dirigidas y la batería general.

## PR425-H03 — consulta de historial descartada en el detalle del comercio

**Archivo:** `src/app/(merchant)/merchant/requests/[id]/page.tsx:26-30`
**Estado:** `[ANÁLISIS]` · mejora abierta

La RPC histórica se inicia en paralelo antes de conocer el estado. Para `draft` el resultado se descarta; para
`matched`, `in_transit` y `delivered` la página redirige a `/trips/[id]`, que vuelve a ejecutar la misma RPC. Conviene
cargarla solo en ramas que realmente renderizan la tarjeta, o encapsular la composición sin duplicar lecturas. No es
N+1 ni fuga de datos, pero agrega latencia/carga evitable en una ruta frecuente.

## NO TOCAR — falsos positivos descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| El cliente decide permisos del historial | No: ambas páginas usan cliente de sesión y la RPC CC-032 filtra pertenencia y actor en PostgreSQL. |
| El texto libre se filtra al navegador | No: comercio y courier reciben `rawReason = null`; la lista tampoco lo renderiza. |
| La oferta terminal vuelve a aceptarse | El E2E intenta reaceptarla y exige error antes de crear la oferta nueva. |
| La cronología pierde el orden | El E2E y el test unitario comparan B→A; la mutación de inversión quedó RED. |
| Faltan eventos nulos o paginación | Wrapper y UI aceptan actor/oferta nulos; la acción usa el cursor keyset y deduplica. pgTAP cubre empate por id. |

## Checks y evidencia

- Local: typecheck ✅; lint ✅; test ✅ en repetición secuencial (148 archivos / 2867 pruebas); dirigidas ✅ (4 / 101).
- Primera ejecución local de `pnpm test`, lanzada en paralelo con otra suite, tuvo un fallo aislado no relacionado en
  `use-request-offers.test.tsx`; el archivo solo pasó 27/27 y la repetición completa secuencial pasó 2867/2867.
- `pnpm test:db`: no disponible localmente (`ECONNREFUSED 127.0.0.1:54322`); job oficial db-tests ✅.
- CI del SHA `2c38dad5`: unit/typecheck/lint/build/audit/bundle-budget/db-tests ✅.
- E2E del SHA `2c38dad5`: run 39236284518 ✅, status commit `e2e-preview` verde, 91 Chromium + 6 global-settings.
- Head documental `e1fa4748`: CI general, Vercel y E2E repetido 39240221298 ✅; `approval-policy` rojo hasta actualizar
  el informe del autor.

## Metodología

Revisión independiente en worktree aislado, árbol limpio, sin secretos ni cambios de implementación. Se inspeccionó el
diff completo, los contratos, reglas y pruebas; se verificaron los runs oficiales y se ejecutó una mutación controlada
restaurada byte por byte.
