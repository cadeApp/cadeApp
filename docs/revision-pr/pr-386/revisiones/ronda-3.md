# Revisión independiente — PR #386 / T-363 — Ronda 3

**Fecha:** 2026-10-16. **HEAD de la PR examinado:** `ddae87422246df38ad7fa96142260993125a6f4f`. **develop observado:** `cd9071110107c393537bc7a71307b2f806cf176c`. **Estado: SIN BLOQUEANTES DE CÓDIGO; NO MERGEAR HASTA COMPLETAR DEPENDENCIA #385 Y CHECKPOINT DE INTEGRACIÓN.**

## Cambios desde R2 y límites de la revisión

- `git compare 6e76e28...ddae874` por GitHub: **1 commit, un único archivo** `docs/tasks/log/T-363.md` (+23/-0); no hubo cambio de código, tests, contrato, migraciones, CI o `docs/revision-pr/pr-386/**`. HEAD remoto coincide con la PR. La rama mantiene H01/H02 corregidos del SHA `99e3b2a` (verificados de manera independiente en R2). D01 continúa aceptada (excepción D15 post-match).
- Se releyeron desde `develop` la ficha T-363, `AGENTS.md`, `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md` y `.agents/skills/revisar-pr/SKILL.md`. **Ficha T-363 idéntica byte a byte** a la rama del PR. El nuevo commit solo registra correctamente CI y trabajo pendiente; no hay pruebas falsas, cambio de expectations o alteración de controles.
- No se reejecutó una batería mutacional nueva: **el código no cambió** desde la que se verificó y documentó en R2. Las 9 mutaciones RED independientes + 4 controles GREEN de R2 siguen trazadas a `99e3b2a`, y los tests reales del HEAD `ddae874` pasaron en CI/E2E.
- No hay clon local ni DNS de GitHub en el contenedor (`git ls-remote` devolvió `Could not resolve host: github.com`); se leyó vía el conector GitHub. Por eso NO se afirma que se ejecutó `git merge-tree`, `pnpm` local ni un navegador conectado al SDK real. Logs de CI/E2E sí se abrieron y verificaron.

## Verificación por hallazgo

| ID | Estado previo | Evidencia actual | Resultado |
|---|---|---|---|
| PR386-H01 | arreglado-verificado en `99e3b2a` | `route-points.ts` sin cambios desde R2; E2E exact-SHA con 5 entregas y 2 tramos; unit PASS | **CERRADO** |
| PR386-H02 | arreglado-verificado en `99e3b2a` | `trip-route-map.tsx` sin cambios desde R2; E2E exact-SHA con 6 pines + `fitBounds`; unit PASS | **CERRADO** |
| D01 | 2-A aprobada por Lautaro073 | no alterada: navegación externa voluntaria y solo post-match | **DECISIÓN RESUELTA** |

`verificado_en_sha` conserva `99e3b2a`: ahí se ejecutó la batería independiente; el HEAD actual solo añade bitácora.

## CI actual — **verificado en los logs y en el SHA**

**CI [38975035726](https://github.com/cadeApp/cadeApp/actions/runs/38975035726)**, checkout del PR HEAD `ddae874`:

| Job | Resultado/observación |
|---|---|
| unit | **SUCCESS**, `Test Files 135 passed (135)`, `Tests 2464 passed (2464)`; runner combina cambio de develop por merge sintético de PR |
| db-tests | **SUCCESS**; `Files=26, Tests=2341, Result: PASS`, paso `pnpm db:types --local` y comparación generada sin diferencias |
| build | **SUCCESS**, `Compiled successfully in 25.4s`; fallo `next/font` de la corrida de R2 **no reapareció** |
| typecheck, lint, audit | SUCCESS |
| bundle-budget | SUCCESS, pero reporta WARNING: `/trips/[id]` **225 kB**, `/merchant/requests/[id]` **192 kB** frente a umbral 180 kB; no hay evidencia de regresión atribuible a T-363 |
| approval-policy | SUCCESS |

**E2E Preview [38975178318](https://github.com/cadeApp/cadeApp/actions/runs/38975178318), job 117237111767:** se verificó la línea `git checkout ... ddae87422246df38ad7fa96142260993125a6f4f` y `HEAD is now at ddae874`; **81 Chromium PASS** (incluido `PR386-H01/H02` con 5 entregas) + **3 global-settings PASS**. El `head_sha` del evento `repository_dispatch` no identifica el checkout efectivo; no se usó para deducir el SHA.

## Integración / compatibilidad con develop

- PR [#385](https://github.com/cadeApp/cadeApp/pull/385) sigue **OPEN y no mergeada**. Su revert de la entrada errónea `af0cf1d7` a develop es un flujo documental separado, no un defecto nuevo en el código de #386.
- `develop` avanzó de `01054b1` a `cd90711` en dos commits adicionales (documentación CC-025, revisiones #370/#376, queries de request, courier onboarding, E2E). **Ningún archivo cambiado desde R2 en #386 está modificado por esos commits**. GitHub indica `mergeable=true` en la base actual; no se sustituye esto por `git merge-tree` real.
- La sincronización posterior al merge de #385 puede tocar `docs/tasks/T-363.md` y su bitácora: conservar los cambios aprobados de la rama T-363 según resolución del merge, sin reescribir historia, y comprobar fichas. No realizar merges sin autorización expresa de Lautaro073.
- Tras resolver la #385: integrar `origin/develop` mediante **merge** y revalidar `git merge-tree --write-tree origin/develop HEAD`, `pnpm exec vitest run tools/verify-fichas.test.ts`, CI y E2E exact SHA integrado. Si ese checkpoint queda verde, **no es necesaria una nueva implementación de H01/H02**; sí verificar y registrar el SHA final.

## NO TOCAR

No editar lógica `route-points.ts` ni `trip-route-map.tsx` para un problema ya resuelto; no inventar tests, reducir cobertura, marcar skips, alterar `.github/**`, secrets, `src/domain/**` o paquetes. No tocar `docs/revision-pr/**` desde el agy. No perseguir el warning de bundle sin comparación medible con base.

**Resultado final de R3:** cero bloqueantes nuevos en el HEAD examinado; PR #386 técnicamente correcta en este SHA, pero su **integración se mantiene pendiente** de #385 y revalidación del árbol combinado. El revisor no aprobó ni mergeó ninguna PR.
