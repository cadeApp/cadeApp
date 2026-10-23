# Informe revisar-pr — T-414 / PR #542 — ronda 2

**Fecha:** 2026-10-22 (Argentina) · **Autor:** revisión independiente de código · **Rama:** `feat/T-414-announcements` → `develop`  
**SHA revisado:** `36cc8dcf519b540b0043ea757047421ce15f8c66` · **Último SHA con código/test modificado:** `238b5a0b19395465eefcc8ffef2c5c31af4745f5` · **Base:** `7d9471fa8b105854b5ae175fa75a12cd9f20c83a`  
**Resultado: SIN BLOQUEANTES. ACEPTADA la revisión independiente.** No es un review APPROVE de GitHub y no implica merge.

## Revisión del cambio

Comparación de `4c0b92713633c351fad711bd543a9da1bce7a639` (ronda 1) a `36cc8dcf519b540b0043ea757047421ce15f8c66`: **dos commits; únicamente cuatro archivos** (`supabase/tests/cc040_announcements.sql`, `src/server/push/announcements.test.ts`, `docs/tasks/T-414.md`, `docs/tasks/log/T-414.md`). No se modificó `docs/revision-pr/pr-542/**` por el autor.

- Ramas: PR #542 abierta/draft, `mergeable=true`, comparación `develop...36cc8dcf` ahead=6, behind=0, misma base, sin hilos de revisión sin resolver. `git merge-tree` no fue ejecutable sin clon; `mergeable=true` es el diagnóstico de GitHub, no una ejecución propia de merge-tree.
- La ficha en `develop`, la CC-040 aprobada, skill `revisar-pr` y acuerdos D01=A / D02=A / D03=A fueron contrastados. No hay ampliación de alcance en esta ronda ni decisiones nuevas.

## H05 — Matriz pgTAP por RPC

**Antes:** faltaban pruebas negativas de las RPC `admin_record_announcement_push`, `admin_list_announcements` y escenarios de las demás.  
**Ahora:** `supabase/tests/cc040_announcements.sql` añade 15 `select is` y pasa de `plan(48)` a `plan(63)`. La nueva matriz junto a seis casos previos cubre las cuatro RPC del admin por sin sesión, comercio y admin aal1, y las tres RPC de cuenta por sin sesión, admin y consentimiento no activo.

**RED real, verificado inspeccionando logs de CI:** la PR de mutación [#544](https://github.com/cadeApp/cadeApp/pull/544) quitó **únicamente** `perform app_private.assert_admin_aal2();` de `public.admin_list_announcements` (diff inspeccionado), en una rama `REVIEW ONLY / NEVER MERGE` **cerrada sin mergear**. El job [120186905912](https://github.com/cadeApp/cadeApp/actions/jobs/120186905912) registró `cc040_announcements.sql`: fallan **test 18 («list: sin sesión»), test 19 («list: comercio»), test 20 («list: admin aal1»)**; `Files=39, Tests=3216, Result: FAIL`. El fallo corresponde exactamente al guard removido.

**GREEN real, verificado inspeccionando logs de CI:** en la PR #542, HEAD funcional `238b5a0b19395465eefcc8ffef2c5c31af4745f5`, el job [120186992745](https://github.com/cadeApp/cadeApp/actions/jobs/120186992745) registra `cc040_announcements.sql ... ok`, `rls_enabled.sql ... ok`, `Files=39, Tests=3216, Result: PASS`, y generación y comparación `src/types/database.types.ts` sin diferencias. El guard está presente en la migración de `36cc8dcf519b540b0043ea757047421ce15f8c66`.

**Estado:** corregido, sin residual. La ejecución RED/GREEN se realizó en CI; la revisión verificó cambios, logs y SHAs, no corrió PostgreSQL/Docker en el contenedor.

## H06 — Concurrencia sin timers

**Antes:** `src/server/push/announcements.test.ts` usaba `setTimeout(resolve,1)`.  
**Ahora:** la prueba usa `Promise` diferidas; retiene los primeros 10 envíos, comprueba `started=10`, libera lote, comprueba 20 y luego 25, y verifica `maxInFlight=10`, `sentCount=25`, 25 intentos. No quedan `setTimeout` ni `setInterval` en la prueba. El chequeo de fuente y la matriz de SQL se comprobaron también con un script de aserciones sobre los archivos del SHA.

**Mutación del autor:** `PUSH_BATCH_SIZE=11` provoca `expected 11 to be 10`; tras restauración, la suite indicada pasa 6/6. **No se reprodujo independientemente ese RED local** porque el contenedor de revisión no puede clonar GitHub.  
**GREEN corroborado en CI independiente:** run [39884806986](https://github.com/cadeApp/cadeApp/actions/runs/39884806986), job [120190375449](https://github.com/cadeApp/cadeApp/actions/jobs/120190375449) del HEAD `36cc8dcf519b540b0043ea757047421ce15f8c66`: `Test Files 177 passed (177)`, `Tests 3361 passed (3361)`. El test de concurrencia está incluido.

**Estado:** corregido sin bloqueantes; la mutación RED local sigue declarada como evidencia del autor, no adjudicada a la revisión. La comprobación independiente es CI GREEN + inspección estática y control de que no hay timers.

## H07 — Ficha y RLS

La ficha `docs/tasks/T-414.md`, checklist de esquema, ahora señala RLS activada con policies restrictivas deny-all, `revoke all` y D01=A. Se contrastó con `docs/contracts/CC-040.md` y las tres `create policy ... as restrictive` de la migración, sin modificar privilegios.

**Estado:** corregido por inspección y aserción textual. Sin residual.

## H01–H04 (ronda 1): sin regresiones identificadas

Los cuatro mecanismos revisados previamente no cambiaron en la ronda 2: distinción error del sender frente a público vacío, confirmación de registro en RPC con `pushRecorded`, paginación por 1000 y consulta de suscripciones en lotes de 100 con páginas, y bloqueo/reintento ante fallo del conteo. Sus suites continúan verdes en CI. La revisión no se atribuye la ejecución de las mutaciones RED que declaró el autor en esa ronda.

## Checks y limitaciones

| Check | SHA / evidencia | Resultado |
|---|---|---|
| Unit `pnpm test:coverage` | `36cc8dcf519b540b0043ea757047421ce15f8c66`, job 120190375449 | **177 archivos, 3361 tests PASS** |
| Typecheck, lint, build, audit, bundle-budget | `36cc8dcf519b540b0043ea757047421ce15f8c66`, run 39884806986 | **PASS** |
| pgTAP y RLS + tipos generados | `238b5a0b19395465eefcc8ffef2c5c31af4745f5`, job 120186992745, mismo código que `36cc8dcf519b540b0043ea757047421ce15f8c66` | **39 archivos, 3216 tests PASS**, tipos sin diff |
| Mutación H05 | PR #544, job 120186905912 | **RED esperado de 3 pruebas exactas**, sin merge |
| Mutación H06 | Bitácora del agente | **RED local informado**; no reproducido por la revisión |
| Vercel preview | `36cc8dcf519b540b0043ea757047421ce15f8c66` | Deployment **success** |
| `e2e-preview` | Workflow 39884942063 sobre `develop` | Workflow success, ejecución E2E **skipped**, contexto externo `e2e-preview=error`; **no equivale a test E2E fallido ni aprobado** |

No se levantó Docker/Supabase local; no se corrió el E2E de T-414, `git merge-tree` ni el script `node docs/revision-pr/analizar.mjs verificacion` por falta de clon (se conserva el error `Could not resolve host: github.com`). Se verificó sintaxis JSONL desde la herramienta que prepara este commit. GitHub indica PR `mergeable=true` y rama no atrasada respecto de develop.

**E2E previsto en la ficha:** después de `migrate-develop`, contra develop/preview. Esa dependencia de integración/despliegue es **posterior a la revisión de código**, no está disfrazada de check ejecutado. El estado externo `e2e-preview=error` con jobs skipped debe revisarse en el ciclo de despliegue; puede afectar una política automática de merge, pero no demuestra defecto de T-414.

## Entrega y límites de autoridad

**SIN BLOQUEANTES — revisión de código ACEPTADA.** Sin nuevas decisiones y sin prompt de arreglos. Lautaro073 conserva la aprobación y el merge; **el revisor no hizo APPROVE ni MERGE**. Este commit documental vuelve a mover HEAD y puede volver a disparar CI: no exigir un nuevo GREEN únicamente por documentación.

### Único paso manual operativo tras el merge

Correr el E2E `e2e/specs/announcements.spec.ts` en develop/preview **después de aplicar `migrate-develop`**, confirmar que recorre login admin MFA, publicación, banner comercio/cierre persistente y ausencia en repartidor. Mantener promociones a staging/main bajo decisión de Lautaro073.
