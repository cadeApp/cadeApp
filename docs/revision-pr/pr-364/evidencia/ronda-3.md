# Evidencia — PR #364 / ronda 3
HEAD funcional: `6c1d124ce17e271858915df3bb57de9beeb1aa6e`. Fuente GitHub connector (fetch_file + CI job logs). No clon local ni SQL ni mutaciones PostgreSQL realizadas por el revisor; análisis estático de código y logs CI verdaderos.

- Run: https://github.com/cadeApp/cadeApp/actions/runs/38702747664. Unit: Test Files 133, Tests 2254 PASS. pgTAP: Files=23, Tests=2262 PASS; suite cc025 .. ok, tipos generados.
- El job db-tests contiene llamadas `node supabase/tests/integration/t340_concurrency.mjs` y `node supabase/tests/integration/cc024_atomic_concurrency.mjs`; los RED/GREEN visibles son de CC-024/T-340. No se vio CC-025 runner de dos sesiones.
- `src/features/courier-onboarding/actions.ts:182-185`: SELECT inicial.
- `actions.ts:207-245`: INSERT; retry/reselect sólo para `errObj.code === '23505'` o mensaje `unique`, cualquier otro error → INTERNAL_ERROR.
- Migración CC-025 líneas 85-102: RLS INSERT `not exists(select 1 from courier_documents where courier_id = auth.uid and kind = new.kind and is_current = true)`.
- `supabase/tests/cc025_courier_document_replacement.sql`, sección "Inserción directa duplicada": test espera `violates row-level security`, no una unique violation. Esto soporta escenario de carrera A SELECT vacío, B INSERT COMMIT, A INSERT → 42501.
- CC-025 sección rollout: paso 1 SQL con REVOKE UPDATE, paso 3 code INSERT, coexistencia con writer viejo UPSERT incompatible; no prueba real de despliegue en esta revisión.
- H06 en pgTAP 704-738: se hace INSERT histórico tras migración y un segundo WITH ranked/UPDATE manual. No es test del backfill del archivo original.
- Todas las calificaciones de corrección por inspección siguen sin `verificado_en_sha`; no se falsificó ejecución de RED funcional.
