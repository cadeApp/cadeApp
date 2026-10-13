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
