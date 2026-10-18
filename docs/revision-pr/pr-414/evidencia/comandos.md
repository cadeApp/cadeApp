# Evidencia reproducible y harness propio — PR #414 / ronda 1

## CI inspeccionado

- SHA: `44285a89618c2b8490e0def6ad239e1b7b5c9910`. Workflow `39099373503`, job db-tests `117592306956`.
- Resumen pgTAP: `Files=30, Tests=2815, Result: PASS` en suite inicial y final.
- Logs explícitos `supabase/tests/cc031_courier_display_name_guard.sql .... ok`, `supabase/tests/rls_coordinates.sql ... ok`.
- Generación `pnpm db:types --local` y `git diff --exit-code -- src/types/database.types.ts` sin diff.
- `unit` 145 archivos PASS. `e2e-preview` error porque no hay migración CC-031 en Develop, no es una prueba contra el trigger.
- `git ls-remote https://github.com/cadeApp/cadeApp.git refs/heads/develop` desde contenedor de revisión falló por DNS `Could not resolve host: github.com`. No hay `psql`/clon utilizable: **esta batería no fue ejecutada**, ni local ni remota.

## Batería propia propuesta: mismo oráculo RED / GREEN (solo DB efímera Supabase de CI)

Se ejecuta **solo dentro del job temporal `db-tests` tras migraciones**, que dispone de `DB_CONTAINER` local y de las dependencias de pgTAP; NUNCA apuntar a Supabase Develop, staging o producción. No usa ni lee secretos remotos. Este es el **script completo** (todavía NO EJECUTADO por el revisor):

```bash
#!/usr/bin/env bash
set -euo pipefail
: "${DB_CONTAINER:?Requiere DB_CONTAINER de Supabase LOCAL efímero de CI}"
testfile="supabase/tests/cc031_courier_display_name_guard.sql"
tmp="$(mktemp -d /tmp/pr414-r1-XXXXXX)"
restore() {
  docker exec -i "$DB_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
    -c 'alter table public.profiles enable trigger guard_courier_display_name_update' >/dev/null 2>&1 || true
}
trap restore EXIT

echo "[GREEN baseline]"
pnpm supabase test db "$testfile" >"$tmp/green-before.log" 2>&1
grep -E 'Files=|Tests=|Result:' "$tmp/green-before.log" | tail -3

echo "[MUTATION: disable CC-031 guard in isolated CI DB]"
docker exec -i "$DB_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -c 'alter table public.profiles disable trigger guard_courier_display_name_update'

set +e
pnpm supabase test db "$testfile" >"$tmp/red.log" 2>&1
status=$?
set -e
if [ "$status" -eq 0 ]; then
  echo "INVALID: mutated guard still GREEN" >&2
  exit 1
fi
# Exigir fallo específico del control original; no sirve un error de setup.
if ! grep -E 'Failed test [0-9]+:.*GREEN: direct courier name update rejected|not ok [0-9]+.*GREEN: direct courier name update rejected' "$tmp/red.log" >/dev/null; then
  echo "INVALID: fallo distinto de la aserción de identidad" >&2
  tail -25 "$tmp/red.log" >&2
  exit 1
fi
echo "RED GENUINO: test original falló por nombre de courier sin trigger"
grep -E 'Files=|Tests=|Result:' "$tmp/red.log" | tail -3 || true
restore

echo "[GREEN restored]"
pnpm supabase test db "$testfile" >"$tmp/green-after.log" 2>&1
grep -E 'Files=|Tests=|Result:' "$tmp/green-after.log" | tail -3
echo "Verificación completada (logs en $tmp)"
```

**Validación del harness pendiente:** sólo puede confirmarse que este script funciona ejecutándolo en el job de DB; no se garantiza su éxito sin ese entorno. Si el reporte de `pg_prove` tiene otra notación, inspeccionar texto de error real antes de cambiar el extractor, sin transformar fallos ajenos en RED. El SQL de base se restaura incluso si el script falla; no se modifica código de la rama ni tests originales.

## Matriz de concurrencia independiente pendiente

Infraestructura existente: `supabase/tests/integration/cc025_b0_concurrency.mjs` y `cc030_orphan_concurrency.mjs` crean dos procesos `psql` vía `docker exec` del contenedor Supabase efímero; soportan waiters y verificación de `pg_locks` / `pg_stat_activity`. Integrar un script exclusivo `cc031_profile_concurrency.mjs`, pero **sólo después de ampliar alcance del CC** (`supabase/tests/integration/**` y `.github/workflows/ci.yml`).

- Caso A: S1 (`authenticated`, sub=courier) comienza TX, escribe `phone` y retiene row lock. S2 (`authenticated`, mismo sub) comienza TX e intenta cambiar `display_name`; comprobar `wait_event_type='Lock'` y esperar commit S1, luego S2 falla con `SQLSTATE=42501` y nombre queda intacto, phone de S1 persiste.
- Caso B: S1 admin corrige nombre mientras retiene lock; S2 courier actualiza phone tras liberar S1; nombre corregido permanece, phone persiste.
- Caso C: S1 admin cambia `consent_status` mientras retiene lock; S2 courier intenta phone; al commit S1, S2 no debe actualizar la fila; si esto falla, **reportar carrera real** y evaluar un CC distinto, no acomodar la aserción.
- Para cada caso: baseline GREEN, mutación deliberada de la guarda en **DB efímera** con resultado RED de la MISMA prueba, restore y GREEN; con IDs sintéticos, código de error, contador de filas, final-state y cierre de ambas sesiones en finally.
- No usar `pg_sleep` como único indicador de solapamiento; el oráculo de espera debe observar lock real. No lanzar workflows manuales desde esta revisión.

## Integración contra develop

GitHub reporta `mergeable=true`, comparación `develop...head`: ahead 6/behind 0 y archivos exactamente `docs/contracts/CC-031.md`, nueva migración, suite pgTAP y `rls_coordinates.sql`. No se corrió `git merge-tree --write-tree`; ejecutar al retomar desde un clon.
