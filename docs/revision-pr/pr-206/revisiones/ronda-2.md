# Ronda 2 — PR #206 / T-327

**Fecha:** 2026-10-02  
**SHA funcional revisado:** `4b47a618d837ccccb35bf13f8df3185b85ec55c1`  
**Resultado:** **CON BLOQUEANTES (2)**

## Sincronización

- develop: `163d4ade24c192e79e713b46ca9de4ec0aa02b7d`
- branch: `4b47a618d837ccccb35bf13f8df3185b85ec55c1`
- ahead: 3
- behind: 0
- merge-base: develop actual

## Revalidación de Ronda 1

### PR206-H01 — ARREGLADO / VERIFICADO

- PR #206 ahora se titula `[T-327] ...` y usa `Refs #205`.
- `docs/tasks/T-327.md` y `docs/tasks/log/T-327.md` existen.
- T-327 está al final de Fase 3 en `docs/implementation-plan.md`.
- El primer DoD de la ficha y la fila del plan son iguales.
- `docs/tasks/T-303.md` y `docs/tasks/log/T-303.md` tienen SHA de blob idéntico a `develop`.
- `verify-fichas` pasa dentro del unit job de CI #868.

### PR206-H02 — ARREGLADO / VERIFICADO

`.github/workflows/e2e-preview-target.mjs` ya no usa `any` funcional:
- payload/API se tratan como `unknown`;
- `record()`, `text()`, `parseRepo()` y `parsePull()` hacen narrowing;
- `githubList()` devuelve `unknown[]`.

CI #868:
- typecheck GREEN;
- lint GREEN;
- workflow tests 47/47 GREEN.

### PR206-H03 — ARREGLADO / VERIFICADO

Las tres reglas autorizadas por P1 ya son coherentes:
- Preview/feat/develop → Supabase Develop;
- staging → Supabase Staging;
- main → producción;
- no se debilitaron las prohibiciones sobre secretos, producción o comandos administrativos remotos.

### PR206-H04 — SIGUE ABIERTO

**GitHub Environment `develop` debe quedar restringido a la rama `develop`.**

La última evidencia disponible sigue siendo la captura de P1 de Ronda 1 con:
`Deployment branches and tags: No restriction`.

El runbook ya documenta correctamente el requisito, pero la revisión no puede leer esa configuración administrativa mediante el conector GitHub disponible.

**Para cerrar:** P1 debe configurar `Selected branches and tags → develop` y aportar confirmación/evidencia.

### PR206-H05 — SIGUE ABIERTO

**Falta evidencia de la configuración necesaria para el primer `migrate-develop`.**

Debe existir en GitHub Environment `develop`:
- variable no secreta `SUPABASE_DEVELOP_PROJECT_REF`;
- `SUPABASE_ACCESS_TOKEN` con acceso al nuevo proyecto Supabase Develop.

El workflow falla cerrado correctamente si falta el ref, pero el merge a develop dispara `migrate-develop` inmediatamente.

**Para cerrar:** P1 confirma que la variable fue creada y que el token existente tiene acceso. No se pide ni se lee ningún valor secreto.

### PR206-H06 — ARREGLADO / VERIFICADO

- Ficha, plan y runbook describen el límite real de GitHub concurrency.
- `cancel-in-progress: false` y grupo global fijo se conservan.
- Se documenta 1 running + 1 pending, reemplazo posible de la pending, status no verde y re-run.
- La revisión actualizó issue #205 para reflejar explícitamente la decisión P1 5-A y que `VERCEL_PROJECT_ID` es un Environment secret.

## Verificación adicional

### Vercel Authentication — decisión 1-A cumplida

Deployment de `4b47a618d837ccccb35bf13f8df3185b85ec55c1`:
- proyecto: `cadeapp-develop`;
- source: git;
- state: READY;
- commit SHA: exacto.

Consulta real:
```
GET <preview>/api/health
200 OK
{"status":"ok"}
```

Por lo tanto el bloqueo 302 de Ronda 1 ya no existe.

### CI exact-head

Run **36977355820 / CI #868**:
```
Vitest:          110/110 archivos · 1627/1627 tests
Workflow tests:  47/47
ADR:             6/6
DB:              13 archivos · 1621 tests · PASS
```

Jobs: unit/build/typecheck/audit/db-tests/lint/bundle-budget — todos GREEN.

`approval-policy` sigue RED porque el body todavía contiene un informe con bloqueantes. Es el comportamiento esperado mientras H04/H05 continúen abiertos; no es un defecto adicional del código.

## Mejora

### PR206-M01 — Alinear la nota de configuración manual de la ficha

`docs/tasks/T-327.md:71-73` agrupa Vercel Authentication entre lo que P1 “tiene que dejar configurado antes del merge”, mientras `docs/runbooks/e2e-preview.md:113-115` refleja la decisión real: Authentication no bloquea el merge, solo el primer GREEN posterior.

Ahora 1-A ya está cumplida, así que no afecta la seguridad ni el merge actual; conviene corregir la frase para que la ficha no contradiga el runbook.

## Resultado

**CON BLOQUEANTES (2): H04 y H05, ambos de configuración manual P1.**

No aprobar ni mergear todavía. El código de la infraestructura y las correcciones H01/H02/H03/H06 quedan verificados en esta ronda.
