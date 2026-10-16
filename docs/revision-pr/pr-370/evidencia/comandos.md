# Evidencia y comandos reproducibles — PR #370, ronda 1

**Base develop inspeccionada:** `e1c3074b575ea7db17b661abac687f1c6e292c63`  
**HEAD inspeccionado:** `7fbf3cedf40e09dd6a5f9046ef8cf6373651622b`  
**Origen:** lectura GitHub de diff, descripción, comentarios, bitácora, ficha de develop y archivos fuentes. **No se ejecutó esta batería local**: el entorno de revisión no pudo resolver `github.com` para clonar.

## Reproducción del alcance remoto desde un clon limpio (PENDIENTE de ejecución local)

```bash
set -euo pipefail
git fetch origin develop feat/T-366-expiracion-historial-comercio
git diff --name-status origin/develop...7fbf3cedf40e09dd6a5f9046ef8cf6373651622b
git diff origin/develop...7fbf3cedf40e09dd6a5f9046ef8cf6373651622b -- docs/tasks/log/T-366.md
git show origin/develop:docs/tasks/T-366.md | sed -n '1,135p'
git log --oneline 7fbf3cedf40e09dd6a5f9046ef8cf6373651622b -- docs/revision-pr/pr-370/
git merge-tree --write-tree origin/develop 7fbf3cedf40e09dd6a5f9046ef8cf6373651622b
```

Salida independiente por consulta a GitHub: `docs/tasks/log/T-366.md` fue agregado (21 líneas), única ruta modificada, 2 commits adelante/0 detrás de develop; API `mergeable=true`. **No reemplaza** la salida de `git merge-tree`, que queda sin ejecutar.

## Confirmaciones estáticas del problema (sin mutación)

```bash
git grep -n "HISTORY_TERMINAL_STATUSES\|ACTIVE_C02_STATUSES" 7fbf3cedf40e09dd6a5f9046ef8cf6373651622b -- src/features/requests/queries.ts
git grep -n "eq('status', 'published')\|lte('expires_at', nowIso)\|audit_log\|offers" origin/develop -- src/server/cron/sweep.ts
git grep -n "REQUEST_EXPIRED" origin/develop -- supabase/migrations/20261009200000_t340_multi_drop.sql
git show origin/develop:vercel.json
```

**Resultado por inspección de blobs:** historia limitada a terminales; activas incluye published; sweep encadena operaciones independientes; RPC existentes comprueban vencimiento; cron diario.

## Mutaciones y checks

No hubo arreglos de código, por lo que **no corresponde inventar un script de mutaciones ni anunciar GREEN**. En la ronda posterior al CC, el revisor deberá guardar aquí el harness COMPLETO de mutaciones propias (funcionando desde `/tmp`, restaura archivos en memoria) y ejecutar control GREEN original + cada RED causal.

Comandos a exigir tras la implementación (no ejecutados en ronda 1):

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm exec vitest run src/features/requests/queries.test.ts
pnpm exec vitest run src/server/cron/sweep.test.ts
pnpm exec vitest run tools/verify-fichas.test.ts
# pgTAP del CC: verificar logs del job db-tests, no iniciar Docker/Supabase local
# E2E Preview: anotar workflow/job y SHA exactos, sin datos reales
node docs/revision-pr/analizar.mjs verificacion
```

**Nota:** `node docs/revision-pr/analizar.mjs verificacion` tampoco se ejecutó en el repositorio completo por falta de clon; el `hallazgos.jsonl` de esta ronda es vacío porque no hay defecto imputado al diff.
## Ronda 2 — SHA 3903388ef6869c218cd405ca0ccc164541ca22e6

Inspección remota: PR #370 files/diff + base develop; `src/features/requests/queries.ts:25–40`, `queries.test.ts:2483–2512`, `e2e/specs/request-states.spec.ts:948–994`, `docs/tasks/T-366.md` desde develop y desde HEAD; issue #355, bitácora y comentarios; status E2E SHA en https://github.com/cadeApp/cadeApp/actions/runs/38793046464 (cancelled); CI https://github.com/cadeApp/cadeApp/actions/runs/38792912853 (SUCCESS).

Reproducción **aislada** y ejecutada en container Node 22, no reemplaza test del repo (GitHub DNS inaccesible):
```bash
node <<'JS'
async function reconcile(rpcClient) {
  for (let batch = 0; batch < 10; batch++) {
    const res = await rpcClient.reconcile_expired_requests({});
    if (!res.ok) throw new Error(res.code);
    if (!res.data.hasMore) return;
    if (res.data.expiredCount === 0) return; // instrucción exacta que falla
  }
  throw Error('Budget exceeded');
}
const fake = { reconcile_expired_requests: async () => ({ ok: true, data: { expiredRequestIds: [], expiredCount: 0, hasMore: true } }) };
reconcile(fake).then(() => console.log('RETURN_OK despite hasMore=true'));
JS
```
Salida ejecutada: `RETURN_OK despite hasMore=true`.

**No ejecutado por revisor**: `pnpm test`, `pnpm test:db`, `pnpm typecheck`, `git merge-tree`, E2E Playwright en Preview, suite de mutaciones propia sobre código real. No se reportan como GREEN/RED ejecutados.

**Mutación RED a exigir al implementador y a una próxima revisión independiente:** en copia aislada de código productivo, reemplazar temporalmente el guard correcto de incompletitud `if (hasMore && expiredCount===0) throw` por `if (hasMore && expiredCount===0) return`, mantener sin modificar el test que exige `rejects.toThrow` y que no haya SELECT. Ejecutar el test focalizado para registrar que cae exactamente por el invariante y restaurar verde. No usar `git checkout` para revertir mutaciones; aplicar/corregir en memoria o worktree limpio sin tocar el HEAD remoto.

Verificación próxima ronda desde clon/worktree limpio:
```bash
git fetch origin
git merge-tree --write-tree origin/develop HEAD
pnpm exec vitest run src/features/requests/queries.test.ts
pnpm exec vitest run tools/verify-fichas.test.ts
pnpm typecheck && pnpm lint && pnpm test
node docs/revision-pr/analizar.mjs verificacion
git diff --check
```
Revisar log completo de db-tests en CI para pgTAP real de CC-026, pero no iniciar Supabase o Docker local.
## Ronda 3 — SHA 26dbe512

Inspección remota: compare 07281133..26dbe512 = 5 commits, 5 archivos, sin tocar review docs; queries.ts:25-50, tests:2486-2670, E2E request-states.spec.ts:955+, ficha develop y PR377. GitHub CI exacta [#38809253455](https://github.com/cadeApp/cadeApp/actions/runs/38809253455), HEAD correcto:

```text
unit: Test Files 133 passed (133); Tests 2379 passed (2379)
db-tests: Files=24, Tests=2283; Result: PASS
pgTAP CC-026: Files=1 Tests=54 PASS; mutante 8/54 FAIL esperado y restaura 54/54 PASS
e2e-preview: run #38809405892, checkout 26dbe51, 79 Chromium PASS (25.0m), 3 global-settings PASS (1.1m); caso #68 T-366 PASS
```

PR #377 OPEN: build job #116635875603 FAIL `next/font` TypeError null reading '1', aunque su diff consta solo `docs/tasks/T-366.md`. Approval-policy todavía sin aprobación de P1.

**No ejecutado por revisor**: pnpm typecheck/lint/test/db; Playwright independiente; mutaciones propias; git merge-tree; Docker/Supabase. `git ls-remote https://github.com/cadeApp/cadeApp.git HEAD` falla por DNS. No declarar `verificado_en_sha` ni atribuir mutación autor al revisor.

Para R4 ejecutar en worktree limpio, después de merge documental:
```bash
git fetch origin
git merge-tree --write-tree origin/develop HEAD
pnpm exec vitest run src/features/requests/queries.test.ts
pnpm exec vitest run tools/verify-fichas.test.ts
pnpm typecheck && pnpm lint && pnpm test
node docs/revision-pr/analizar.mjs verificacion
git diff --check
```
Registrar versión final de Preview E2E + RED causal, no cambiar checks ni fabricar resultados.

## Ronda 4 — inspección SHA `9bbd2aca4e3d96b1673dbac80997bba55e1d02b5`

- Compare `96b09df..9bbd2ac`: 4 commits y SOLO `docs/tasks/log/T-366.md`, `e2e/specs/request-states.spec.ts`. Review folder sin cambios del implementador.
- E2E [#38825238979](https://github.com/cadeApp/cadeApp/actions/runs/38825238979), job 116731124891: checkout `HEAD is now at 9bbd2ac`, `Running 79 tests`, T-366 (#68) PASS, `79 passed (22.5m)`, luego `3 passed (1.1m)`. El `head_sha` del repository_dispatch corresponde a develop base pero el **checkout efectivo** y status de 9bbd2ac son comprobables. No inventar un run de tipo pull_request.
- CI [#38825154664](https://github.com/cadeApp/cadeApp/actions/runs/38825154664) jobs lint/typecheck/build/unit/db-tests/audit/bundle-budget SUCCESS. Unit `133 files/2379 tests PASS`; pgTAP `Files=24 Tests=2283 Result: PASS`; mutante CC-026 8/54 FAIL intencional y luego 54/54 PASS; harness CC-026 GREEN. Algunos avisos Docker rate-limit transitorios en log sin resultado final fallido.
- Approval-policy job 116740004412 log `Aprobación de Lautaro073 vigente.` (check SUCCESS) para PR #370. No implica aprobación por el revisor.
- Secuencia E2E comprobada en código: `page.goto(merchant requests)` líneas 1010; `accept_offer` RPC 1015; `Promise.all(reconcile_expired_requests)` 1045; `while(hasMore)` 1075; `page.goto('/merchant/history')` 1083; **no hay semilla nueva entre RPC y navegación**. Por tanto no prueba transición automática en el historial.
- PR #377 OPEN no mergeada, sólo ficha documental, build next/font TypeError null reading 1 job 116635875603, approval-policy FAIL; ficha develop todavía vieja. No usar checks de #370 para justificar el merge de #377.

**Prueba mutacional PENDIENTE, NO ejecutada por revisor:** en copia temporal del código de producción `src/features/requests/queries.ts`, comentar exclusivamente `await reconcileMerchantExpiredRequests(supabase)` al comienzo de `getMerchantHistoryRequests`; con fixture `lazyRequestId` publicada vencida sembrada inmediatamente antes de visitar historial, el E2E debe fallar por ID ausente o DB `published`. Restaurar sin adulterar test y constatar GREEN. Si el mutante **sigue verde**, el instrumento de prueba aún es insuficiente.

**No ejecutado:** clon/worktree local, pnpm, E2E mutation, git merge-tree, node analizar.mjs, Supabase/Docker manual. DNS github.com inaccesible desde contenedor. Ningún `verificado_en_sha` fabricado.
