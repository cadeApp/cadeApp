# Evidencia — revisión independiente PR #381 ronda 1

**SHA:** `82f1cb179a4a5135a8a6c837faa647baefaa74be`; inspección GitHub de migración original B0, pgTAP, script dos sesiones, contrato, workflow y logs oficiales. NO Supabase/Docker/SQL ejecutado por el revisor.

## CI
Run https://github.com/cadeApp/cadeApp/actions/runs/38852141921 sobre SHA exacto. Unit: 133 suites / 2366 Vitest PASS. DB pgTAP: `Files=25, Tests=2311, Result: PASS`. db:types generado. Todos los jobs exitosos. Runner CC025-B0 produjo mensajes de casos iguales, distintos y convivencia. **El log de mutación dice literalmente** `RED confirmado por error de carrera: [CC-025-B0][MUT_S1] proceso psql terminó con código 3 mientras esperaba COMMIT`. No hay cardinalidad mutada indicada en ese RED.

## Lecturas concretas (clases completas)
- Migración B0 líneas 5–10 SECURITY DEFINER search_path, 30–45 auth y profile (ANTES del lock), 47–55 lock courier con SELECT `profile_id,vehicle_type` (sin status), 64–98 validación kinds requeridos, 100–110 detección duplicados ya existentes, 113–158 SELECT+INSERT, 169–170 REVOKE/GRANT.
- Fase A: `courier_documents_expansion_guard` congela is_current/rejection_code/idempotency_key; no limita `(courier_id,kind)`. Original `courier_documents_insert_self` permite INSERT courier propio con submitted/purge null; schema v1 unique(storage_path) exclusivamente. Un path alternativo cumple esa policy aunque ya exista mismo kind.
- `cc025_b0_concurrency.mjs`: test 1 dos sesiones misma ruta; test 2 dos rutas distintas con `setTimeout(200)`; test 3 REST directo con mismo path `dni_front_b0.jpg` y verifica 23505; runMutationCheck remueve FOR UPDATE, usa `pg_sleep(0.1)`, catch genérico que establece `mutationCaught=true`, y restablece SQL en finally.
- SQL autor conservador para license/insurance: flags requeridos solo para 4 obligatorios, PERO bucle 113–158 lee documentos ya insertados en misma transacción; duplicado opcional con diferente path genera error y revierte el lote. Esta sospecha inicial se descartó expresamente tras enumerar el recorrido completo.
- Status courier: no se lee en la RPC; fixture pgTAP crea couriers pending únicamente. Consent profile: se lee una sola vez antes del lock y puede quedar obsoleto durante espera.

## Pruebas propuestas, NO ejecutadas
- Authenticated REST INSERT del mismo kind con path alternativo tras RPC; snapshot de filas debe exponer garantía ausente (o demostrar barrera, si la hubiera).
- RPC directa authenticated de courier rejected/suspended con consent activo, 4 docs válidos; expectativa segura de error y cero inserts.
- Cambio de consent_status entre lectura inicial y adquisición de lock courier; revalidación de profile debe rechazar.
- Quitar FOR UPDATE con harness dos sesiones y asserts de cardinalidad/orden. Un proceso psql exit=3 no prueba por sí mismo defecto de concurrencia.

**No aprobación/merge ni cambios de implementación.**