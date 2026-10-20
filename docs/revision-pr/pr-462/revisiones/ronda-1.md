# Revisión independiente — PR #462 / T-384 / CC-033

**Fecha:** 2026-10-20
**PR:** https://github.com/cadeApp/cadeApp/pull/462
**HEAD revisado:** `aadfb2e47953da5db38916a31913475c0e5b440d`
**Base develop:** `cf2fbe13ab7ee8348b4805dadccef5416abb9265`
**Resultado:** SIN BLOQUEANTES (0), dentro del alcance operativo del renombrado.

## Alcance y verificación
- Diff de tres rutas: bitácora `docs/tasks/log/T-384.md`, migración CC-033 renombrada, y ruta de `cc033_concurrency.mjs`. Ningún cambio en SQL, contratos, RLS, políticas, dependencias o workflows.
- Ficha `docs/tasks/T-384.md` leída en develop; las tres rutas están contempladas por los «Archivos permitidos» (comodín de migración, integración y bitácora).
- Original `supabase/migrations/20261020065319_cc033_add_courier_optional_document.sql` en develop y nuevo `supabase/migrations/20261020190000_cc033_add_courier_optional_document.sql` en HEAD tienen **el mismo Git blob** `836466307e4c1aa9dd4fce12b61b95bf7597d743`; GitHub reporta `renamed` con `changes=0`. En HEAD sólo queda el nombre nuevo.
- Orden: CC-034 `20261020113000` < CC-035 `20261020123000` < CC-033 `20261020190000`. El archivo de concurrencia referencia únicamente el nuevo nombre.
- Se leyeron las migraciones CC-034/035: crean funciones distintas; no modifican ni llaman a `add_courier_optional_document`. No hay dependencia directa de la migración de CC-033 en ellas.
- `develop` seguía en `cf2fbe13ab7ee8348b4805dadccef5416abb9265` durante la verificación, sin desvío de base. GitHub declaró `mergeable: true`; no se ejecutó `git merge-tree` localmente.

## Incidente confirmado
Workflow `migrate-develop` run **39460281895**, commit `cf2fbe13ab7ee8348b4805dadccef5416abb9265`, job **118757652445**, terminó con error:
```
Found local migration files to be inserted before the last migration on remote database.
Rerun the command with --include-all flag to apply these migrations:
supabase/migrations/20261020065319_cc033_add_courier_optional_document.sql
```
Esto demuestra que el nombre viejo no fue aplicado en esa corrida. No se usaron `--include-all`, credenciales remotas ni comandos administrativos. La ausencia histórica en *todos* los remotos se declara en el body/bitácora, pero no se verificó por consulta directa; no se presenta como evidencia independiente.

## Pruebas sobre HEAD revisado
Workflow CI **39467922609**, event `pull_request`, SHA `aadfb2e47953da5db38916a31913475c0e5b440d`, resultado `success`.
- `typecheck`, `lint`, `unit`, `db-tests`, `build`, `audit` y `bundle-budget`: success.
- `unit`: 152 archivos, 2989 tests passed.
- `db-tests` job **118784085061**: la base efímera aplicó CC-034 → CC-035 → CC-033 en ese orden; pgTAP `Files=34, Tests=3019, Result: PASS`; `cc033_concurrency.mjs` terminó sin deadlocks y `--mutation-check` reportó RED detectada y GREEN restaurada; drift de tipos `git diff --exit-code -- src/types/database.types.ts` pasó.
- E2E Preview: run **39468001103** reportó literalmente `BLOCKED / REQUIRES DEVELOP MIGRATION`. `e2e-preview` tiene estado error deliberado y NO debe convertirse artificialmente en success: la política `.github/workflows/e2e-preview-target.mjs` lo bloquea para PR con `supabase/migrations/**`.
- `approval-policy`: falló sobre el SHA antes de publicar este informe; el script `.github/workflows/approval-policy.mjs` requiere informe completo bajo `### Informe de revisión de agy` en el BODY del PR, no basta con comentario.
- No se corrieron tests locales ni Docker/Supabase local por la regla operativa; la evidencia de ejecución proviene de CI y se contrastó con el diff y logs.

## BLOQUEANTES
Ninguno.

## MEJORAS
Ninguna requerida para esta corrección puntual.

## NO TOCAR — falsos positivos descartados
- No proponer `--include-all` ni comandos administrativos: hay solución de historial de migraciones sin acceso remoto.
- No exigir E2E Preview en esta PR de esquema: en este caso el bloqueo es intencional y el E2E no puede verificar esquema aún inexistente en Develop remoto.
- No reescribir el SQL ni agregar una segunda migración: el blob es idéntico y `db-tests` probó la migración reordenada.

## Verificación pendiente **después** del merge
1. Observar el nuevo `migrate-develop` disparado por el merge: debe aplicar `20261020190000_cc033_add_courier_optional_document.sql` y terminar `success`.
2. Sólo entonces liberar T-376, que depende de esa RPC en Develop.
3. Revisar qué ocurrió al promover a staging/producción en su flujo propio; no hacer intervenciones manuales ni saltarse history checks.

## Metodología y limitación
Inspección independiente mediante GitHub: SHA y árbol del commit, comparación de blob, diff, ficha en develop, logs reales de Actions y lectura del gate E2E/approval-policy. La prueba de migración real en el remoto todavía depende del merge. El control de RED está sustentado por el fallo operativo original y por las mutaciones de CI, pero no se ejecutó un arnés local de Git ni DB aquí. No se afirma verificación remota de staging o producción.