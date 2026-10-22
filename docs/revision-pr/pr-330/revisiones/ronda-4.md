# PR #330 — T-340 Paso 4 — revisión independiente Ronda 4

- **Fecha:** 2026-10-14. **HEAD de Asako inspeccionado:** `141173d8965f63575cbe51dade4326550fcd7b9d` (commit funcional `fbf8d01225a7eab432d230dc43a91977a664c35e`, bitácora `141173d8`).
- **Resultado: CON BLOQUEANTE H03 (integración transaccional aún no aplicada en este writer)**; H07 y H08 **ARREGLADOS-VERIFICADOS**. H01/H02/H04/H05/H06 se mantienen cerrados de ronda 3, con evidencia histórica sobre SHA correspondiente. No se encontró duplicación de componentes o nueva RPC por Asako.

## H07 — corregido por Asako y verificado
- `src/features/requests/components/create-request-form.tsx:644–655,721–805`: `lastAttemptRef` guarda requestId, snapshot original y `JSON.stringify` canónico en memoria; bloquea el submit de payload editado tras error y alerta con `role=alert`; da dos decisiones explícitas: reintentar snapshot con UUID original o confirmar nueva intención con UUID nuevo. No guarda PII en localStorage/logs.
- `src/features/requests/components/create-request-form.test.tsx:686–864` añade 2 casos que comprueban red fallida, edición, bloqueo de segunda llamada, reintento del payload original con UUID igual y confirmación nueva con UUID distinto. Los controles de reintento sin edición y de UUID entre formularios se conservan.
- CI REAL sobre **este HEAD** [run 38574983243](https://github.com/cadeApp/cadeApp/actions/runs/38574983243), `unit` job `115889598848`: **129 archivos, 2145 tests PASS** y archivo formulario **23 tests PASS**. Se leyó el código y el log. Las mutaciones RED de fingerprint/UUID se declaran en la bitácora del autor, pero el revisor **no las volvió a ejecutar**; no se atribuyen como independientes.

## H08 — corregido por Asako y verificado
- La entrada `docs/tasks/log/T-340.md:1617–1621` informa `Files=21, Tests=2039, Result: PASS` para run 38562296772 job 115846119404; coincide con el log histórico verificado. Se corrigió la discrepancia de 1980 específica de esa sesión, no se alteraron entradas históricas de otros jobs.

## H03 — ÚNICO HALLAZGO DE CÓDIGO ABIERTO: backend ya mergeado, falta conexión de writer
- **Cambio real de estado desde R3:** [PR backend #333](https://github.com/cadeApp/cadeApp/pull/333) mergeada el 2026-10-14T17:46:05Z, commit de develop `c97e0d839c1cb6aa3a6645b10a33d8d313dd7d16`. `src/server/rpc/requests.ts` y `src/domain/rpc-contracts.ts` ya exponen el wrapper y schema de `create_and_publish_multi_drop(p_payload jsonb)`.
- **Migración remota:** run [38609451699](https://github.com/cadeApp/cadeApp/actions/runs/38609451699), job `migrate-develop` **116008725669 SUCCESS**; log aplicó exactamente `20261014110000_cc024_atomic_multi_drop.sql` en Supabase Develop. Se confirma Gate 2 y el despliegue técnico de migración, NO un checkpoint de comportamiento real 1/N/legacy.
- **Gate 3 aún incompleto:** los runs `e2e-preview` postmerge 38609638111/38609638126 sobre develop terminaron `success` a nivel workflow, pero los jobs `e2e-preview` quedaron **SKIPPED** tras `resolve-preview`. No se encontró en esa evidencia comprobación real 1/N de la RPC ni legacy con SHA migrado. No poner Gate 3 GREEN ni desbloquear Gate 4 por el mero merge.
- **Writer:** `src/features/requests/actions.ts:54–181` conserva la secuencia insert request → pickup → N drops → contactos privados → `callRequestRpc(...,'publish_request',...)`; son transacciones HTTP separadas y el rollback de CC-024 no es aplicable. Con Gate 3 acreditado debe sustituirse por **una sola** `callRequestRpc(supabase,'create_and_publish_multi_drop', normalizedPayload)` sin inserts/publish adicionales.

## Integración / mergeabilidad
- Comparación contra `develop` actual `c97e0d8`: branch writer `141173d8` está **1 commit detrás**, estado `diverged`. GitHub REST PR `mergeable=false, mergeable_state=dirty`, por lo que **hay un conflicto real que resolver antes de merge**.
- Intersección mecánica de rutas cambiadas desde el ancestro `3a453762`: **solo `docs/tasks/log/T-340.md`** entre la PR backend y PR writer. Resolver el conflicto conservando ambas bitácoras, sin perder el registro de pruebas y decisiones. No se ejecutó `git merge-tree` local por carecer de un clon; tampoco se acredita un archivo exacto de conflicto solo por la intersección.

## Evidencia y dictamen
- CI HEAD `141173d8`: `unit`, `db-tests`, `typecheck`, `lint`, `build`, `audit`, `bundle-budget` SUCCESS. `db-tests` ejecutó **2039 tests** del esquema **pre-#333** en esa rama, no los 2177 de RPC ya mergeada en develop. El `approval-policy` sigue FAILURE y requiere nueva revisión y body correcto.
- E2E previa de PR #330 `e2e-preview` status SUCCESS run 38575138784 (dispatch posterior a `141173d8` pero HEAD del workflow develop anterior `3a453762`); Chromium **73 PASS + 1 flaky** (falló primer intento de onboarding courier y pasó al retry #2), global-settings **3 PASS**; writer multi-drop #46 pasó con **inserciones antiguas**, no prueba la RPC nueva. No atribuir E2E premerge a Gate 3 o writer atómico.
- No se ejecutó por el revisor SQL local, CI manual, Docker, Supabase remoto, Playwright propio ni mutaciones RED→GREEN independientes. Inspección GitHub + logs auténticos y comparaciones de SHA. No se aprobó, mergeó ni editó funcionalidad.
- **Dictamen: CON BLOQUEANTE H03** (Gate 3 checkpoint de RPC/legacy y conexión writer nueva, más resolver mergeability). H07/H08 cerrados. No hace falta volver a solicitar decisiones de contrato; CC-024 está mergeado y migrado.
