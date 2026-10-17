# Evidencia de ronda 2 — PR #374 / CC-025 fase A

**SHA funcional auditado:** `f8d338af2c72c64ffe8ccdead0d032c4700ff92d`. **No se ejecutó SQL local/remoto por revisor**, solo GitHub connector (diff, código, CI logs) y detector independiente estático en memoria.

## CI del SHA, leído por dentro
[GitHub Actions 38784606824](https://github.com/cadeApp/cadeApp/actions/runs/38784606824):
- Job `unit` 116593263053: `Test Files 133 passed (133)`; `Tests 2328 passed (2328)`.
- Job `db-tests` 116593263152: `Files=23, Tests=2229, Result: PASS`; pgTAP `cc025_expand_courier_documents.sql .. ok`.
- Build job 116593262911: `Compiled successfully in 23.4s`; check SUCCESS; `typecheck`, `lint`, `audit`, `bundle-budget` también SUCCESS.
- Runner de compatibilidad log: inserción inicial autenticada GREEN, UPSERT sin colisión GREEN, colisión real de mismo ID DENEGADA por RLS heredada 42501, actor ajeno 42501, CHECK forja 23514.
- Runner mutation log: `is_current` omitida de migración produce `42703` en test, restauración GREEN; `REVOKE UPDATE` produce `42501` en UPSERT nuevo, `GRANT UPDATE` restaura GREEN.
- `db:types` generados sin drift en pipeline. `approval-policy` SUCCESS. Todos corresponden exactamente a `f8d338af2c72c64ffe8ccdead0d032c4700ff92d`.

## Controles estáticos independientes efectuados con contenidos remotos, en memoria JS, sin editar repo
Comprobado 11/11:
- tres ADD COLUMN exactos, guard de CHECK exacto y ausencia de REVOKE/índices/policies nuevos en la fase A;
- pgTAP fuerza `ON CONFLICT(id)` con ID existente y espera 42501 en rol autenticado;
- runner tiene `BEGIN; SET LOCAL ROLE authenticated`, aserciones `current_user`/`auth.uid()`, actor ajeno;
- mutation `REVOKE UPDATE` y restauración `GRANT UPDATE`.
Control de sensibilidad del detector: `schema.replace("idempotency_key is null","true")` hizo fallar la expresión regular del guard (RED **estático**, no funcional de DB).

## Alcance e incertidumbre
El viejo `.upsert(documentEntries)` de `develop` no envía `id` explícito, por lo que en alta normal usa IDs nuevos; al forzar misma PK se obtiene 42501 por policy UPDATE ya existente. Eso documenta una limitación anterior, no una regresión de la migración A. La fase B debe corregir reintentos e idempotencia. El revisor NO ejecutó por sí mismo las mutaciones SQL del autor; `hallazgos.jsonl` deja `verificado_en_sha=null`. No se realizaron E2E reales de onboarding ni despliegue de DB en esta revisión.