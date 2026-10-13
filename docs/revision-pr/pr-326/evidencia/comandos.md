# Evidencia y verificaciones — PR #326 ronda 1

## HEAD y alcance

`develop=4eefd119b19792e179e46b1243d07ab957137649` / `feat/T-340-limpieza-legacy=7866da28973da6b45746ff000c11cef3d8cbb772`. `get_pr_info`, `fetch_pr_patch`, `list_pr_changed_filenames` y consulta de commits en GitHub.

Los 8 archivos son: `docs/tasks/log/T-340.md`, `e2e/specs/t340-legacy-checkpoint.spec.ts`, `src/features/requests/actions.test.ts`, `src/features/requests/actions.ts`, `src/server/e2e/staging-seed.test.ts` (aceptado por dueño), `src/server/e2e/staging-seed.ts`, `supabase/migrations/20261013140000_t340_clean_legacy.sql`, `supabase/tests/t340_multi_drop.sql`.

## Fuente de la causa

`supabase/migrations/20261013140000_t340_clean_legacy.sql:16–35` contiene `t340_backfill_legacy()`, `coalesce(dc.notes, r.notes)` y el `update delivery_requests set notes=null, cash_change_amount=null` sin filtro de respaldo. El helper de la migración previa `20261009200000_t340_multi_drop.sql:1601–1611` materializa drops solo cuando los datos del legado son completos; `:1635–1641` solo inserta contactos cuando hay drop pos.1. `request_cycle` de nueva migración `:230–234` copia y limpia en rama sin drop; `:335–339` limpia también en ruta con drops existentes.

Estos son hallazgos **por inspección de SQL**, no ejecución adversarial. El diseño de los casos negativos se conserva abajo para usarlo en la siguiente ronda.

## Comprobación de CI (remota, no local)

- `https://github.com/cadeApp/cadeApp/actions/runs/38444629108` sobre `7866da28973da6b45746ff000c11cef3d8cbb772`: `unit` 129 suites / **2.136** Vitest PASS, workflows 79 y ADR 6; `db-tests` 21 archivos / **2.003** pgTAP PASS, `t340_multi_drop.sql` incluido. Log de DB declara `Result: PASS` y drift checks; typecheck/lint/build/audit/bundle-budget PASS.
- `e2e-preview` commit status **error**, `BLOCKED / REQUIRES DEVELOP MIGRATION`. No representa ejecución Playwright fallida ni exitosa.
- `approval-policy` FAILURE antes del informe independiente. No alterar workflow ni declarar solución porque el formato de informe pueda pasar.

## Casos adversariales requeridos para la siguiente ronda (SIN mutar base remota)

A. Antes de ejecutar la migración, insertar un **draft incompleto** con `notes='marcador privado'` y `cash_change_amount=500` válido en el padre, sin drop/contacto hijo. Tras migración: comprobar que se mantiene el borrador y ambos valores; no se crea un drop inválido.

B. **No-draft inconsistente** con valores legacy no-NULL y sin contacto privado verificable. Ejecutar migración en transacción de PostgreSQL efímero → excepción genérica sin valor privado y **rollback completo**; no debe limpiarse ningún legacy de las otras filas por ese intento. Si se usa `RAISE EXCEPTION`, comprobar código/estado sin mostrar la información.

C. **No-draft consistente** con drop1/contacto igual que legacy y otro con contacto privado distinto de legacy. El primero se limpia y conserva datos privados. El segundo **no** puede destruir/ignorar datos: rechazá el lote y documentá resolución (sin decidir por silencio qué valor es canonical).

D. **Puente legacy**: con 0 drops y con un drop1 preexistente. Al publicar, preservar ambos valores y limpiar padre en la misma transacción. Ante contacto ausente o divergente: falla cerrada sin publicación ni limpieza, con rollback.

E. **Idempotencia**: ejecutar dos veces la rutina controlada; no se duplican drops/contacts y no se pierden notas/montos.

F. **Mutación RED auténtica:** en un Postgres efímero preparado con fixtures de A/B/C, sustituir TEMPORALMENTE el predicado de limpieza por el UPDATE global del HEAD auditado, comprobar que el test específico detecta pérdida/inconsistencia (RED). Revertir **en memoria y sin commit**; mismo test GREEN con predicados corregidos. No falsificar la mutación ni alterar el oráculo. Conservar evidencia de comandos/resultados/SHAs en bitácora.

No se ejecutaron aquí los casos A–F, porque el revisor no utilizó Docker/Postgres remoto ni tiene clon propio en esta sesión. **No reportar RED o GREEN de esas mutaciones como comprobados por este revisor**.

## Validación documental

Se leyeron `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, `docs/tasks/T-340.md` y `docs/contracts/CC-022.md` desde Develop. Decisión expresa de Lautaro073 por esta conversación: C y excepción de archivo de test.

## Ronda 2 — SHA funcional `57b50977feb1c1365fb1515bbf434d41c2755a93`, 2026-10-13

Comparación GitHub: `793c8ce6...57b50977` cambió **solo** `supabase/migrations/20261013140000_t340_clean_legacy.sql`, `supabase/tests/t340_multi_drop.sql` y `docs/tasks/log/T-340.md`. No hubo cambios por el agy en `docs/revision-pr/pr-326/**`; la carpeta de R1 se preservó.

**Código y rutas contrastadas:**

- `supabase/migrations/20261013140000_t340_clean_legacy.sql:16–105`: función privada SECURITY DEFINER `app_private.t340_clean_legacy`, `set search_path = public, pg_temp`, REVOKE a clientes; backfill, sync del drop 1, `not exists` por fila con comparación `IS NOT DISTINCT FROM`, aborta ante no-draft no respaldado, UPDATE selectivo `r.status <> 'draft'`. Limpieza global R1 retirada. Diagnóstico contiene solo count.
- `:315–381`: `request_cycle` para drafts con drops existentes obtiene drop1 bajo lock de parent y `for update of d`, rechaza diferencias por valor, sincroniza faltantes, reconsulta y limpia solo tras verificar. Ruta sin drops crea drop/contactos antes de limpiar. No cambios de permisos, roles o validación de suscripción.
- `supabase/tests/t340_multi_drop.sql:1450–1935`: sección 11, 28 asserts nuevas → `plan(128)`. Se inspeccionaron oráculos de borrador incompleto, published sin respaldo y rollback, datos íntegros, divergencia notes/cash, bridge con drop previo y repetición.
- **Laguna detectada:** `pg_temp.test_clean_legacy_repeated_idempotent()` hace `perform app_private.t340_clean_legacy(); return 1;`; `select is(...,1)` pasa por el valor constante si la llamada no lanza error, no prueba invariancia de notas/monto/contacts. La aserción siguiente solo cuenta drops, y no compara el contacto privado completo. Complementar sin borrar controles actuales.

**CI verificado:** [run 38466089472](https://github.com/cadeApp/cadeApp/actions/runs/38466089472) sobre SHA funcional `5e185e5010b1503df4e5c50352a2e09532510ab9` (el HEAD `57b50977` agrega solo entrada de bitácora). `db-tests` job `115533143973`: log real `Applying migration 20261013140000_t340_clean_legacy.sql`, `t340_multi_drop.sql ... ok`, **Files=21, Tests=2031, Result: PASS**. `unit` job `115533144058`: 129 archivos / 2136 tests; lint/typecheck/build/audit/bundle-budget PASS. Mutaciones CI reales **H13 y H14** (del mecanismo de delivery), restauradas GREEN; **NO hubo mutaciones RED de PR326-H01/H02/H03 en el log**. Los RED del agy en bitácora son **analíticos**, no ejecutados.

**Estado Preview:** Vercel SUCCESS. `e2e-preview = BLOCKED / REQUIRES DEVELOP MIGRATION`, expected por SQL nuevo; NO equivale a PASS/fallo de comportamiento. `approval-policy` falla con el informe R1 con bloqueantes; también depende de formato.

**Límite de la revisión:** consulta de GitHub + inspección de código e informes, sin `pnpm` local, Docker, DB ni scripts de mutación. No inventar outputs. Revisor deja H01/H02 como `arreglado-sin-verificar`; H03 `parcial` hasta RED ejecutado y verificación de idempotencia.
