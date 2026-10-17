# Evidencia — PR #364 / ronda 4
HEAD auditado `2251ee79122b914034bf0b28d0b2a2a3e07a4c09` en GitHub, 2026-10-15. No comandos contra DB local/remota, ni despliegues ni mutaciones por revisor.

### CI real
- [CI run 38711308994](https://github.com/cadeApp/cadeApp/actions/runs/38711308994), jobs audit/typecheck/lint/build/unit/db-tests/bundle-budget SUCCESS. pgTAP Files=23, Tests=2262, Result PASS; unit 133 Test Files PASS. Tipo db:types generado sin drift.
- H02: log `[CC-025][H02] Escenario 1 GREEN...`, `Escenario 2 GREEN...`, `Control de mutación RED confirmado...`; revisión del script muestra sesiones psql reales con `pg_stat_activity` y lock observable. Negativo cruza `FOR UPDATE` mediante DO manual como postgres, NO modifica definición RPC.
- H06: log `[CC-025][H06] ... sembrand[o] fixture pre-migración`, aplica `pnpm supabase migration up`, verifica, luego `RED ... now()+30 -> uploaded_at+30` en migración original y `GREEN` restaurada. Inspección del runner confirma reescritura temporal protegida por finally y reset de DB.
- R03: unit tests h–k usan mock `insert` que responde 42501, relectura exacta; no runner real de requests PostgREST para ese flujo (el de concurrencia actual prueba RPC admin/courier).

### Prueba independiente por inspección de código (sin ejecutar PostgreSQL)
- Action `src/features/courier-onboarding/actions.ts:184`: `select('id, kind, storage_path, status, is_current')`.
- Migración `supabase/migrations/20261015020000_cc025_courier_document_replacement.sql:4-7`: `ADD COLUMN IF NOT EXISTS is_current`; por tanto DB previa no tiene la columna. En compatibilidad app nueva/DB vieja, el SELECT es inválido. Faltaría test real contra DB previa para convertir inferencia en verificación funcional.
- `.github/workflows/migrate.yml`: `on.push.branches: [develop,staging,main]`, `pnpm supabase db push --yes` por ambiente.
- `.github/workflows/deploy.yml`: workflow_run tras `migrate` completado y condición `conclusion=success` para staging/main; la migración precede al deploy de ese SHA. Contradice CC-025 §Compatibility fases app antes SQL y frase «CI garantiza».
- Comparación contra develop: ahead=20, behind=0; CC-026 de commits traídos de develop NO aparece en diff actual de PR.

### Chequeo de sensibilidad propuesto
En DB efímera de CI pre-CC: `select is_current from public.courier_documents limit 1` debe fallar `42703` (RED contrato app-first); tras migración expansiva debe pasar (GREEN). En el rollout completo, comprobar realmente vieja app vs expand DB y nueva app vs expand/contract. Se requiere artefacto separado y prueba real; NO se fingen outputs.