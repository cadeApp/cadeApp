# Revisión independiente — PR #317 / T-340 — ronda 2

Fecha: 2026-10-10. SHA revisado: `5bba8319d93ca02d1253ddd63132e9b1b8562a6e`.
Base: `develop` (`7cf1a653`, behind=0). Resultado: **CON BLOQUEANTES (4). NO MERGEAR.**

## Ronda anterior

- **H01 corregido:** desapareció la referencia inválida a `zones.is_active`; la migración completa en CI.
- **H02 corregido:** se retiraron nombres, teléfonos y consentimientos ficticios del backfill. La auditoría de otras inconsistencias sigue incompleta (H09).
- **H03 parcial:** los 22 `pass()` desaparecieron y ahora hay 40 aserciones reales sintácticamente, pero tres casos de backfill prueban SQL escrito por el propio test, no el backfill de la migración (H07).
- **H04 corregido:** fixture de `zones`, `pickup_zone_id` y contador `plan(40)` se verificaron con 1943 pruebas pgTAP verdes en CI.
- **H05 corregido:** se retiró del paso 1 la redefinición de `get_trip_details`.

## Nuevos bloqueantes

**PR317-H06 — CRÍTICO — Guard de serialización desactivado**  
`supabase/migrations/20261009200000_t340_multi_drop.sql:71-119`. La función `app_private.lock_draft_request_for_child_write()` pasó a `SECURITY DEFINER`, contrario a CC-022 §2b y la ficha, que exigen `SECURITY INVOKER`. El cuerpo decide si bloquear según `current_user in ('authenticated', 'anon')`; en una función `SECURITY DEFINER` el usuario efectivo es el dueño, por lo cual **no alcanza las validaciones ni el bloqueo para las escrituras directas del cliente**. La RLS puede seguir rechazando casos aislados, pero no garantiza el lock ante publicación concurrente. Corregir a `SECURITY INVOKER` sin debilitar RLS/grants, verificar que inserciones legítimas funcionan y demostrar que fallan carreras reales o un control estructural exacto cuando se invierte el modo de seguridad.

**PR317-H07 — ALTO — Pruebas de backfill con resultados creados por el propio test**  
`supabase/tests/t340_multi_drop.sql:548-620`. `test_backfill_incomplete_draft()` crea un borrador después de aplicar la migración y verifica ausencia de drop; `test_backfill_inconsistent_nondraft()` escribe él mismo en `audit_log` la fila que espera encontrar; `test_backfill_repeated_no_duplicates()` ejecuta dos consultas manuales `insert ... where not exists` en vez de llamar al backfill productivo. Estas pruebas no detectarían que el bloque productivo fuese eliminado. Extraer lógica del backfill a un helper privado que la migración y el test ejecuten (u otro mecanismo con ejecución real del mismo SQL); probarla con fixtures y mutación RED donde el backfill productivo se desactiva.

**PR317-H08 — ALTO — No se prueban condiciones de carrera**  
`supabase/tests/t340_multi_drop.sql:138-236`. Los casos sobre el guard son secuenciales, en una sola conexión. El DoD exige concurrencia contra `publish_request` de `insert/update/delete` sobre drops y `update` sobre drop_contacts, con orden de locks reproducible. Esta ausencia explica que H06 sobreviva con CI verde. Requerir dos sesiones reales, prueba de consistencia de versión y prohibición de escritura posterior a publicación; no usar `sleep` ni sustituir por búsqueda textual sin mutaciones.

**PR317-H09 — ALTO — Históricos con pago inconsistente quedan sin drop ni auditoría**  
`supabase/migrations/20261009200000_t340_multi_drop.sql` (bloques finales `legacy_migration_inconsistent` y materialización). El filtro de auditoría contempla campos/consentimiento faltantes, pero el filtro de materialización rechaza también combinaciones de pago inválidas. Si un request no-draft tiene datos personales completos y, por ejemplo, medio `transfer` con `needs_change=true`, o efectivo con cambio y monto nulo, no se crea drop **ni se registra como inconsistente**. Completar el filtro de auditoría para cubrir todos los casos que omite el backfill y probarlo sobre el código productivo, incluyendo idempotencia.

## Evidencia

GitHub Actions run `38098236439` — job `db-tests` `114348546731`, asociado al SHA revisado:
- Aplicación de la migración T-340: PASS.
- Bootstrap: `Files=1, Tests=10, Result: PASS`.
- PgTAP completo: `Files=21, Tests=1943, Result: PASS`; `t340_multi_drop.sql` figura OK.
- Generación `db:types --local`: PASS, sin drift.
- Otros checks: unit, typecheck, lint, build, audit y bundle-budget SUCCESS; `approval-policy` FAILURE.

**La revisión de H06–H09 es por inspección estructural y prueba lógica de sus condiciones, no por ejecución de carreras sobre una base local.** La política del proyecto prohíbe levantar Supabase/Docker local; la nueva batería SQL deberá validarse en CI. No se aprueba ni mergea.

## Informe revisar-pr

Informe revisar-pr — T-340 — 2026-10-10 — generado por revisión independiente

Resultado: CON BLOQUEANTES (4)

Checks locales: typecheck n.e. · lint n.e. · test n.e. · test:db n.e. (db-tests CI ✅)

BLOQUEANTES:
- H06 migration:74 → revertir guard a SECURITY INVOKER y comprobar locks.
- H07 tests:548 → ejercitar backfill verdadero, sin autofabricar resultados.
- H08 tests:138 → cubrir cuatro carreras reales contra publicación.
- H09 migration:final → auditar todas las exclusiones de pago.

MEJORAS: ninguna por separado.

No revisado / dudas para Lautaro073: no quedan decisiones de producto; el checkpoint post-merge permanece pendiente.
