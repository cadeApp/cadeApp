# Prompt agy — CC-025 / PR #364 — arreglos de ronda 3

**CÓDIGO AUDITADO:** `6c1d124ce17e271858915df3bb57de9beeb1aa6e`. **Rama:** `cc/CC-025-courier-document-replacement`. **Decisiones confirmadas:** 1C/2C/3B/4C y B, retención 30 días desde reemplazo. **No repreguntar.** No aprobar ni mergear #364/#358.

**Inicio obligatorio:** `git fetch origin && git switch cc/CC-025-courier-document-replacement && git pull --ff-only origin cc/CC-025-courier-document-replacement && git status --short`. La revisión ronda 3 quedó commiteada; traela antes de programar. Leé `docs/revision-pr/pr-364/revisiones/ronda-3.md`, `evidencia/ronda-3.md`, el contrato, la ficha T-356 y skill contract-change. Usá agentes técnicos para comprobar todas las rutas de RLS/privilegios. Prohibido modificar `docs/revision-pr/**`, `AGENTS.md`, `.agents/**`, secretos o migraciones anteriores ya mergeadas, salvo autorización específica. No force, rebase, amend, falsear tests ni tocar gates.

**Archivos autorizados para arreglos del CC:** `src/features/courier-onboarding/actions.ts`, `actions.test.ts`; `supabase/migrations/20261015020000_cc025_courier_document_replacement.sql` (solo si es necesario, aún no mergeada), `supabase/tests/cc025_courier_document_replacement.sql`; `docs/contracts/CC-025.md`. Para H02/H06, reutilizá o agregá scripts muy acotados `supabase/tests/integration/cc025_*.mjs` en la DB efímera del CI, y añadí su invocación ADITIVA al job db-tests de `.github/workflows/ci.yml`. **No alterar** otros scripts, suites, thresholds, jobs ni dependencias. Si fuera inevitable ampliar archivos, detener ese fragmento y declararlo en bitácora.

### R03 BLOQUEANTE — carrera 42501
- Reproducí interleaving: A SELECT no docs; B INSERT docs propios y COMMIT; A intenta INSERT mismo payload. La policy `NOT EXISTS` devuelve RLS **42501** en vez de `23505`, según el caso. `actions.ts` solo maneja 23505.
- Corregí recuperación para error RLS por existencia sin abrir permisos. Volvé a validar actor/consents y existencia EXACTA de todos kinds, current, paths iguales, status permitido; sólo eso permite éxito idempotente. No tratar un error genérico 42501 como éxito por sí solo, y si hay otra razón de denegación, devolver fallo seguro. Considerar variante transaccional si no se puede distinguir con seguridad.
- Tests unitarios nuevos: error `42501` RLS con lectura posterior idéntica → success; con path discrepante/faltante → fail; error por consentimiento/actor no autorizado → fail; `23505` sigue correcto. Prueba dos sesiones simulando COMMIT entre SELECT/INSERT, no solo mock de 23505. **Mutación RED auténtica**: quitar solo rama de recuperación y observar assertion incorrecta con mismos tests; restaurar y GREEN.

### R04 — rollout compatible
El CC actualmente dice SQL (REVOKE UPDATE) antes que deploy de nuevo escritor INSERT. Esto rompe el backend viejo UPSERT. Cambiá `docs/contracts/CC-025.md` a secuencia **app nueva primero, migración después**, validación de writer nuevo frente a DB vieja y nueva, rollback y gate que impida DB nueva/app vieja. No alterar la decisión B ni permisos para soportar viejo upsert indefinidamente.

### H02 — prueba real de dos conexiones
El CI sí permite dos sesiones: `supabase/tests/integration/t340_concurrency.mjs` y `cc024_atomic_concurrency.mjs` corren en el mismo job. Reutilizá patrón con `admin_verify_document` AAL2 y `replace_courier_document` courier; same kind/current con locks en dos órdenes, sin deadlock 40P01, current único, audit sin duplicados. Test sensible a mutación de invertir orden SQL; igual fixtures y aserciones. Si no se ejecuta, reportar pendiente, jamás decir prueba GREEN.

### H06 — test backfill REAL
Sembrar duplicados antiguos en DB efímera **antes** de aplicar la migración CC-025. Aplicar migración original; verificar `is_current`, `purge_after > now()+29 days` para antiguo uploaded_at de 90 días y preservar `purge_after` previo. La suite pgTAP actual copia el UPDATE después de migrar y no prueba la migración real. Mutar sólo SQL original `now()+30`→`uploaded_at+30` y exigir RED de mismo fixture, restaurar GREEN.

### Verificar regresiones
No tocar reparaciones H01/H03/H04/H07/R01/R02. Agregar/ejecutar mutaciones funcionales específicas de SQL (Storage bucket vacío, RLS SELECT, UPDATE y key, idempotencia) con test inalterado. No adjudicar RED de CC-024/T-340 a CC-025. Nada de tests/mocks adulterados, skips, solo green fingido, SQL remoto o Docker local.

### Entrega
Integrar `origin/develop` mediante MERGE (behind 1 al revisar), NO rebase. CI real del SHA final: typecheck, lint, unit, build, db-tests, tipos, integration y eventualmente gates de PR. `git diff --check`, `git merge-tree --write-tree origin/develop HEAD`, `node docs/revision-pr/analizar.mjs verificacion`, `git status --short` y `git ls-remote origin cc/CC-025-courier-document-replacement`. Registrar en bitácora pruebas y límites con SHA/run exactos; no editar la carpeta de revisión. Commit/push y pedir ronda 4. No merge ni approve.