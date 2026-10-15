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
