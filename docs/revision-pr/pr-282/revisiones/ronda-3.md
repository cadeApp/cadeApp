# Informe de revisión — PR #282 / CC-023 — ronda 3

**PR:** https://github.com/cadeApp/cadeApp/pull/282  
**Head SHA revisado:** `1f134ce4ef219bf504dd954ee9cacc5a730a74da`  
**Base:** `develop` @ `80f0b56a9ff94d3c4e10fb215c63faccd9097365`  
**Fecha:** 2026-10-06

## Resultado

**CON BLOQUEANTES (2 nuevos).**

H03 y H04 quedan cerrados. La revisión completa del rollout encontró dos contradicciones operativas que ya tienen decisión humana: **1-A** para board-sync y **2-A** para el E2E post-merge.

## H03 — aceptado

La excepción B quedó acotada correctamente:

- la regla general 1 tarea = 1 issue = 1 rama = 1 PR sigue vigente;
- el CC puede autorizar varios PR sucesivos cuando el orden de rollout lo exige;
- cada paso tiene rama, CI, revisión y checkpoint propios;
- T-345 define ramas distintas y bitácora única.

**Estado:** `aceptado` por decisión de Lautaro073 e inspección de `AGENTS.md`, regla 50, CC-023 y T-345 en `1f134ce`.

## H04 — cerrado

`src/types/database.types.ts` ahora está asignado al **PR 1**, junto con la migración que crea `get_merchant_request_private_fields`, y el checkpoint exige drift check de `db-tests` verde.

**Estado:** `arreglado-verificado` por inspección en `1f134ce`.

## PR282-H05 — board-sync contradice la excepción multi-PR

La documentación afirma que PR 1 y PR 2 con `Refs #281` mantienen el issue abierto y que solo el último PR lo cierra. El workflow actual no usa esa semántica.

`.github/workflows/board-sync.mjs`:

1. recorre PR cerrados/mergeados a `develop`;
2. todo head `feat/T-345-*` agrega `T-345` a `mergedTaskIds`;
3. `computeBoardTransitions` lo incorpora a `completedTasks`;
4. si no hay un PR abierto, `isCompleted` queda true;
5. el transition queda `hecha` y `shouldCloseIssue=true`;
6. el workflow hace PATCH del issue a `state: closed`.

El texto `Refs #281` no interviene. Por lo tanto el primer merge de T-345 cerraría #281 y además podría desbloquear tareas que dependan de T-345 antes de completar los tres pasos.

### Decisión de Lautaro073 — 1-A

Corregir board-sync y cubrirlo con tests. Para una tarea declarada multi-PR:

- un paso mergeado **no** la agrega al conjunto de dependencias completadas mientras su issue siga abierto;
- si no hay PR abierto pero ya existe un paso mergeado, el estado debe permanecer **En curso**, no Hecha/Lista;
- un PR siguiente abierto manda `en-curso`/ `en-review` según draft;
- solo el **issue realmente cerrado** convierte la tarea en Hecha y permite satisfacer dependencias;
- el comportamiento histórico de tareas normales de un solo PR no cambia.

La ficha debe tener un marcador estable/machine-readable de rollout multi-PR para que el workflow no dependa de frases libres.

## PR282-H06 — el E2E del enforcement es imposible pre-merge

T-345 exige actualmente `e2e-preview GREEN en cada PR`. Eso no puede ocurrir en PR 1 ni PR 3 porque ambas traen migraciones.

El gate trusted de T-327:

- inspecciona los changed files;
- si hay `supabase/migrations/**`, publica `BLOCKED / REQUIRES DEVELOP MIGRATION`;
- no arranca Playwright;
- ningún workflow de PR aplica schema remoto;
- `migrate-develop` corre recién por push a `develop`, después del merge.

El runbook del repo lo documenta explícitamente y PRs anteriores con migraciones siguieron ese patrón.

### Decisión de Lautaro073 — 2-A

Mantener **3 PR mergeables** y agregar un gate post-merge no mergeable:

1. **PR 1 — RPC + tipos:** `Refs #281`. Como toca migración, `e2e-preview = BLOCKED / REQUIRES DEVELOP MIGRATION` es esperado; el gate relevante es DB/CI.
2. **PR 2 — lectores:** `Refs #281`. Sin migración: `e2e-preview GREEN` obligatorio.
3. **PR 3 — enforcement:** también **`Refs #281`**, no `Closes`. Como toca migración, el bloqueo de preview es esperado; merge solo con DB/CI/revisión verdes.
4. Esperar `migrate-develop GREEN` del SHA mergeado.
5. Desde el `develop` ya migrado, abrir `review/T-345-post-enforcement-e2e`, título/cuerpo **REVIEW ONLY / NEVER MERGE**, sin `supabase/migrations/**` y sin alterar producción. El commit de disparo puede ser únicamente documental/bitácora.
6. Ese Preview ejecuta los specs ya mergeados —incluido `courier-private-columns.spec.ts`— contra Supabase Develop con el enforcement real.
7. Solo con `e2e-preview GREEN`: registrar el run, cerrar la PR review sin merge y **Lautaro073 cierra manualmente #281**. El evento `issues.closed` deja que board-sync la marque Hecha.

La regla 50 debe contemplar esta variante: si existe un gate post-merge, **ninguno** de los PR mergeables usa `Closes`; todos usan `Refs` y el cierre se hace después del gate.

## Checks del SHA revisado

Sobre `1f134ce`:

- typecheck ✅
- lint ✅
- unit ✅ en CI
- build ✅
- audit ✅
- bundle-budget ✅
- db-tests ✅
- Vercel ✅
- e2e-preview ✅ para #282 (esta PR no trae migraciones)
- approval-policy ❌ porque el informe anterior todavía declaraba bloqueantes.

El autor registró flakes locales de `pnpm test`; CI exact-head de unit quedó verde. Eso no cambia H05/H06.

## Conclusión

No se mergea todavía. Agy debe implementar 1-A/2-A en workflow + tests + reglas/CC/ficha/bitácora, sin implementar aún T-345.
