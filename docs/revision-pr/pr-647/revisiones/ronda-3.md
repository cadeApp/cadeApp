# Informe final de revisión — PR #647 / T-406 — ronda 3

**Fecha:** 2026-11-07  
**SHA de implementación revalidado:** `2629198c017364b707f308257fb399886feed828`  
**Base develop integrada:** `b0060d51773f65f3f446d9ea9a1be382e8a153f5`  
**Método:** inspección GitHub de diff exacto y fuente T-428; logs oficiales de Actions y E2E trusted. Sin clon local ni ejecución Playwright propia.

## Dictamen

**SIN BLOQUEANTES — ACEPTACIÓN TÉCNICA FINAL de T-406 para merge, sujeto al acto de Lautaro073.** No se aprueba por GitHub ni se mergea desde la revisión. El PR permanece Draft al emitir el dictamen: Lautaro073 decide cuándo marcar Ready y mergear.

## Matriz de verificaciones

| Control | Evidencia oficial | Evaluación |
|---|---|---|
| Integración con develop | commit `2629198c`, padres `1448833c` (R2) y `b0060d51` (develop/T-428); GitHub `mergeable: true` y comparación `behind:0` | Conforme, sin conflictos registrados |
| Alcance | `develop...2629198c` compara 27 rutas de T-406/revisión, coincidentes con la ficha ampliada. T-428 llega del padre develop, no es cambio ajeno añadido al diff T-406 | Conforme |
| CI general | run [42347461806](https://github.com/cadeApp/cadeApp/actions/runs/42347461806), SHA de head exacto, `unit`, `db-tests`, `typecheck`, `build`, `lint`, `audit`, `bundle-budget`: 7/7 `success` | PASS |
| Suite unit y herramientas | autor: 198 archivos / 3735 tests; tools 103 passed; CI unit `success` | PASS CI, ejecución local propia no realizada |
| E2E T-406 | [42348140310](https://github.com/cadeApp/cadeApp/actions/runs/42348140310), job `128330314643`, checkout explícito `2629198c`; `✓ incidents.spec.ts:372` | PASS |
| Hotfix externo T-428 | ficha y PR #654 integradas en develop `b0060d51`; la fixture lee `active_vehicle_id` y lo inserta como `vehicle_id` de la licencia; `✓ courier-onboarding.spec.ts:1056` en **primer intento** | PASS |
| Gate E2E completo | run 42348140310 `conclusion: success`: 122 `passed`, 1 `flaky`, 0 `failed`; 7 global-settings `passed` | GREEN, con flaky heredado registrado |
| `approval-policy` | check del SHA `2629198c`: `success` y body con informe obligatorio | PASS |
| Manual | repositorio GitHub indica PR abierta/Draft, no se ejecutó `git merge-tree` local ni se inspeccionó UI con navegador propio | No sustituye aceptación automatizada |

## H01 y D01=C — vigentes tras el merge

**H01 (MFA duplicado):** `openAdminPageWithMfa` enrola/verifica **un único factor**, devuelve `{ adminPage, adminApi }` y el test T-406 ejecuta la RPC con `adminApi` AAL2. No hay segundo `elevateAdminToAal2`; el escenario en 2629198c pasa en el gate real. El estado H01 permanece `arreglado-verificado`, R2, y se revalida aquí.

**D01=C (contador periódico):** `GET /api/live/open-incidents` responde solo el count, con autorización admin+AAL2, caché desactivada y validación de contrato Zod estricto. `AdminNav` conserva el `initialData` del layout, hace polling TanStack Query cada **60 segundos** mientras la pestaña está visible y refetch al foco/reconexión, **sin Realtime**. Sigue sin bloquear el panel si el conteo falla; texto accesible correcto y badge fuera del link para conservar su nombre. Las pruebas unitarias y E2E de la feature pasan; la mejora opcional de probar ticks reales del temporizador continúa no bloqueante.

**H02 (`approval-policy`):** corregida en ronda 2 con el informe en body. Para este SHA la ejecución del control está `success`. Se actualizó la descripción de la PR con la aceptación final y el estado de los gates, sin tocar el código.

## Fallo anterior #653: cerrado por T-428, confirmado

En ronda 2 `courier-onboarding.spec.ts:1056` fallaba 3/3 porque el seed insertaba la licencia sin el vínculo `vehicle_id` exigido desde CC-042/T-419. La PR #654 / T-428 agregada a develop lee el `couriers.active_vehicle_id` real, falla temprano si falta y asocia **solo** la licencia a ese ID, sin relajar las aserciones de rechazo/privacidad/reemplazo. En gate 42348140310 el mismo E2E pasa **sin reintento**. La integración de T-428 se revalida como dependencia externa, no se crea nuevo hallazgo para T-406.

## Flaky T-407: deuda QA explícita, NO corregida en T-406

El test `e2e/specs/admin-audit-filters.spec.ts:69` falló dos veces por selectores de texto duplicado antes de pasar en retry #2: **un caso flaky, no un test estable**. El gate completo concluyó `success` según GitHub; se mantienen 0 fallos definitivos. El comportamiento se localizó históricamente fuera de T-406 (#636/#639). Hay plan de investigación y dueño externo en **[issue #639](https://github.com/cadeApp/cadeApp/issues/639)**, **[PR #655 / T-429](https://github.com/cadeApp/cadeApp/pull/655)**. T-429 no se da por completada ni se supone GREEN sin retries. No se añade `.skip`, `.first()` ni waiver para ocultarlo. La aceptación de T-406 no cancela la obligación de QA según `.agents/rules/40-testing.md`.

## NO TOCAR

- No reabrir H01 ni cambiar la implementación D01 por un flaky de Auditoría que no toca la feature.
- No debilitar políticas MFA, RLS o tests. La corrección de T-428 de la fixture fue integrada vía develop, no se duplica en la rama de incidentes.
- No cambiar pruebas T-407 dentro de T-406; continuar por #639 / #655.

## Alcance de la aceptación y cierre

**Aprobación técnica de revisión:** SÍ, **SIN BLOQUEANTES**. **GitHub PR approved / merged:** NO; Lautaro073 decide. Cuando se marque Ready, comprobar que el SHA de código y los checks sigan correspondiendo a esta revisión. No exigir E2E nuevo por un commit estrictamente documental que solo agrega `docs/revision-pr/pr-647`, pero sí si se vuelve a incorporar código nuevo.

**Ejecuciones locales propias:** ninguna. El revisor sí inspeccionó los logs trusted, los commits y el diff con GitHub. Las salidas y métodos reproducibles están en [evidencia/comandos.md](../evidencia/comandos.md). No se alteraron las rondas anteriores.
