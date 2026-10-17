# Evidencia independiente — PR #376, ronda 1

**SHA:** `680b1accd134fbcbcf33ae87fd0478c13dc9a5a2`. Fuente: GitHub connector (diff, fetch_file, SQL base, CI logs). **NO** se levantó Docker, ni Supabase local/remoto, ni se ejecutaron mutaciones funcionales SQL por el revisor.

## CI de implementación (auténtico)
Run https://github.com/cadeApp/cadeApp/actions/runs/38792087496 — SHA `680b1accd134fbcbcf33ae87fd0478c13dc9a5a2`: workflow SUCCESS; `unit` job 116619178411 registra **Test Files 133 passed**, **Tests 2377 passed**; `db-tests` job 116619178714 registra **Files=24, Tests=2283, Result=PASS**, `db:types` generado. `build,lint,typecheck,audit,bundle-budget` SUCCESS. El body y comentario del autor mencionan 2374 unit, distintos del log. Los runners de concurrencia que se ven en DB son de CC-024, CC-026 y T-340, **no del writer B**.

## H01 — escenario sin prueba funcional
- Esquema base `supabase/migrations/20260922031435_schema_v1.sql`: `courier_documents.storage_path text not null unique` (índice actual por ruta), sin unique(courier_id,kind).
- Migración A `20261015153311_cc025_expand_courier_documents.sql`: ADD COLUMN de is_current, rejection_code, idempotency_key + CHECK, **sin** unique(courier_id,kind).
- Action: SELECT 182–185, INSERT 214–217, postSELECT 289–292, count-only 301–308, couriers UPDATE 321–324. Cada llamada Supabase es una transacción distinta; no lock duradero entre SELECT e INSERT. Interleaving paths DISTINTOS puede persistir duplicados mientras A ya devolvió éxito.
- Test n `actions.test.ts:1805-1885`: una sola invocación, `select` preparado con cuatro filas adicionales artificiales con las **mismas** rutas que dbDocuments. Esa fixture viola UNIQUE(storage_path) del esquema PostgreSQL real. Prueba solo que un snapshot simulado de duplicados da error, no una carrera real.
- Control independiente estático del revisor: detectó secuencia SELECT→INSERT→SELECT→UPDATE sin RPC/transaction y postcheck sin lock. Es análisis, no RED runtime DB.
- RED pendiente: 2 sesiones con rutas DISTINTAS para el mismo kind y distintos commits, sin unique kind; reproducir en DB efímera con barrier.

## H02 — estado inconsistente
- Action 204–212: `if (!existing) insert; else if (existing.storage_path !== entry.storage_path) reject`; **no comprueba `existing.status`**.
- Recovery 271–278: sí exige `submitted || verified`, contradicción entre caminos.
- Test b 937–1000: fixture de cuatro docs todos `submitted`, no rejected. Contrato Fase B acepta solo submitted/verified.
- Test pendiente RED→GREEN: uno rejected con mismo path, 4 docs, ambos INSERT y UPDATE courier prohibidos.

## H03 — postvalidación parcial
- Action 289–309 valida solo conteo >1. Sin comparación con `documentEntries` ni estados; un rejected o path cambiado de un doc preexistente entre lecturas sigue count=1 y marca onboarding en 321–324.
- Test pendiente RED→GREEN: 3 docs previos, cuarto INSERT success, postSELECT devuelve 4 de los cuales uno tiene `status='rejected'` o `storage_path != expected`. El mock debe representarlo sin forzar output falso.

## No hecho
No se ejecutó concurrency de dos sesiones por el revisor, no se modificó implementación ni schema y no se autorizó nuevo alcance B0. No firmar verificado-en-sha.