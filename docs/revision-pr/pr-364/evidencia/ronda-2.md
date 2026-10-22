# Evidencia — PR #364 / Ronda 2 (HEAD 6e06e8ae7ade883d974644344f3597dcb526e2c2)

Fuente: GitHub connector en HEAD exacto, código SQL/action/pgTAP/test y logs de CI. No se ejecutó PostgreSQL local, Docker o Supabase; hallazgos R01/R02 se basan en lectura y comportamiento documentado, no una reproducción de request remoto.

**CI:** https://github.com/cadeApp/cadeApp/actions/runs/38692082266; 133 archivos / 2228 unit PASS; 23 files / 2245 db PASS; db:types generados. Las mutaciones RED/GREEN de este run que pude ver son CC-024/T-340, NO CC-025.

**Contradicción independiente R01:**
- SQL línea 63: revoke update, delete on table public.courier_documents from public, anon, authenticated.
- src/features/courier-onboarding/actions.ts líneas 180–222, cliente autenticado, queryBuilder.upsert sin ignoreDuplicates.
- SQL INSERT de PostgreSQL: https://www.postgresql.org/docs/current/sql-insert.html indica que ON CONFLICT DO UPDATE necesita privilegio UPDATE aun para propuesta no conflictiva.
- API JS Supabase: https://supabase.com/docs/reference/javascript/upsert explica el comportamiento de upsert que fusiona duplicados.
- PostgREST: https://postgrest.org/en/v12/references/api/tables_views.html con Prefer: resolution=merge-duplicates.
- Suite pgTAP actual usa INSERT normal para primer documento; mocks vitest retornan éxito del upsert, no prueban permisos reales.

**R02:** CREATE POLICY courier_documents_insert_self en SQL 85–102 omite condición idempotency_key IS NULL. SQL 176–201 considera esa key como operación ya ejecutada si coinciden courier/kind/storage_path. Test pgTAP no intenta INSERT inicial con key.

**H06:** en pgTAP después de la migración: comentario "Ejecutar logica de backfill sobre duplicados" + WITH ranked ... UPDATE manual. No ejecuta la migración en fixture anterior a su aplicación. Aun mutando la expresión original, ese test verde no protege el backfill.

**H02:** SQL RPC courier y admin lock courier->document; pgTAP plan(40) es una sola transacción y no contiene un runner de dos sesiones.

## Control estático de sensibilidad (NO es prueba funcional PostgreSQL)

Copiar literalmente en /tmp/pr364-r2.cjs y correr desde checkout SHA:
```bash
cat >/tmp/pr364-r2.cjs <<'NODE'
const fs=require('node:fs'); const assert=require('node:assert/strict');
const sql=fs.readFileSync('supabase/migrations/20261015020000_cc025_courier_document_replacement.sql','utf8');
const app=fs.readFileSync('src/features/courier-onboarding/actions.ts','utf8');
const pg=fs.readFileSync('supabase/tests/cc025_courier_document_replacement.sql','utf8');
const p=/queryBuilder\.upsert\s*\(/;
assert.match(sql,/revoke update, delete on table public\.courier_documents from public, anon, authenticated/);
assert.match(app,p);
assert.match(app,/const queryBuilder = supabase\.from\('courier_documents'\)/);
const section=sql.split('create policy courier_documents_insert_self')[1].split('-- 5. RPC pública')[0];
assert.doesNotMatch(section,/idempotency_key is null/i);
assert.match(pg,/-- Ejecutar logica de backfill sobre duplicados[\s\S]*?with ranked/);
console.log('GREEN detector estático en HEAD original (no prueba funcional)');
const mutated=app.replace('queryBuilder.upsert(', 'queryBuilder.insert(');
assert.notEqual(app,mutated);
assert.doesNotMatch(mutated,p);
console.log('RED detector ante mutación en memoria (no test de DB)');
NODE
node /tmp/pr364-r2.cjs
```

Durante la revisión con datos recuperados del SHA remoto se comprobaron los mismos predicados por JS y mutación textual: original GREEN, con replacement detector RED. NO se ejecutó el script contra un clon local y NO se certifica RED funcional del código.
