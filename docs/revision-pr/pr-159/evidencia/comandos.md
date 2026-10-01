# Evidencia reproducible — PR #159

## Ronda 1

**SHA revisado:** `680511dc625ce3fec4a65e0b7268a3a7a955512e`

### Sincronización y alcance

```text
base: develop
head: feat/T-321-admin-staging-bootstrap
status: ahead
ahead_by: 3
behind_by: 0
merge_base: 9e232d0e4ef003ca0535b11e5a962b4cf603189a
PR mergeable: true
```

### RED real previo de los embeds

Commit `118042c3eaceb0a18ac9380168e389a2e584c024`:

```text
Test Files  1 failed | 107 passed (108)
Tests       5 failed | 1520 passed (1525)
```

### CI de ronda 1

Run `36803697869`, db-tests:

```text
Applying migration 20260930224700_t321_admin_staging_bootstrap.sql...
Seeding data from supabase/seed.sql...
supabase/tests/t321_admin_staging_bootstrap.sql .. ok
Files=13, Tests=1612
Result: PASS
```

La ronda 1 demostró que seed.sql enmascaraba los defaults y que la aserción 11 probaba un DO NOTHING copiado dentro del test.

---

## Ronda 2

**SHA revisado:** `ce5e3a19f3dfba71da4ccd47610b06beee3a2de2`

### Cambios desde el último commit de revisión

```text
ahead_by: 2
behind_by: 0

.github/workflows/ci.yml
docs/tasks/T-321.md
docs/tasks/log/T-321.md
supabase/tests/t321_admin_staging_bootstrap.sql
```

No hubo cambios del autor en `docs/revision-pr/pr-159/**`.

### Reproducción de la evidencia del autor

CI run `36813709928`, job `db-tests`:

```text
supabase/tests/t321_admin_staging_bootstrap.sql .. ok
All tests successful.
Files=1, Tests=10
Result: PASS

T321_MIGRATION_BASELINE GREEN
T321_M01 RED_OK: missing:min_offer_ars=1000, missing:request_ttl_minutes=30, missing:pilot_active=true, missing:pilot_terms_version=v1, missing:subscription_grace_days=0, missing:ON_CONFLICT_DO_NOTHING
T321_M02 RED_OK: missing:ON_CONFLICT_DO_NOTHING

...
All tests successful.
Files=13, Tests=1611
Result: PASS
```

Esto verifica el cierre técnico de PR159-H01.

### Batería independiente nueva — M03

Objetivo: atacar el checker agregado por el arreglo, no reutilizar M01/M02.

Copiar como `/tmp/pr159-round2.sh` y ejecutar:

```bash
bash /tmp/pr159-round2.sh .
```

Harness completo:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT=${1:?repo root required}
CI="$ROOT/.github/workflows/ci.yml"
SRC="$ROOT/supabase/migrations/20260930224700_t321_admin_staging_bootstrap.sql"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/supabase/migrations"

# Extrae y ejecuta el checker real que vive dentro del heredoc del workflow.
awk '
  /node <<'\''NODE'\''/ { in_node=1; next }
  in_node && /^[[:space:]]*NODE[[:space:]]*$/ { exit }
  in_node { sub(/^          /, ""); print }
' "$CI" > "$TMP/checker.cjs"

DST="$TMP/supabase/migrations/20260930224700_t321_admin_staging_bootstrap.sql"
cp "$SRC" "$DST"

(cd "$TMP" && node checker.cjs) > "$TMP/baseline.out"
grep -F 'T321_MIGRATION_BASELINE GREEN' "$TMP/baseline.out" >/dev/null

# M03: semántica destructiva real + comentario que conserva la cadena esperada.
node - "$SRC" "$DST" <<'NODE'
const fs = require('node:fs');
const [src, dst] = process.argv.slice(2);
const sql = fs.readFileSync(src, 'utf8');
const mutant = sql.replace(
  /on\s+conflict\s*\(key\)\s*do\s+nothing\s*;/i,
  'on conflict (key) do update set value = excluded.value;\n-- on conflict (key) do nothing;'
);
fs.writeFileSync(dst, mutant);
NODE

set +e
(cd "$TMP" && node checker.cjs) > "$TMP/m03.out" 2>&1
M03_RC=$?
set -e

if [ "$M03_RC" -eq 0 ]; then
  echo 'M03 CONTROL_CIEGO: DO UPDATE + comentario señuelo mantiene el checker GREEN.'
  grep -F 'T321_MIGRATION_BASELINE GREEN' "$TMP/m03.out"
else
  echo 'M03 DETECTADO'
fi
```

Salida reproducida por la revisión con los contenidos exactos del SHA revisado:

```text
M03 CONTROL_CIEGO: DO UPDATE + comentario señuelo mantiene el checker GREEN.
T321_MIGRATION_BASELINE GREEN
```

### Por qué el pgTAP sin seed no salva M03

El reset sin seed aplica T-321 sobre una base fresca. La fila todavía no existe, así que tanto `DO NOTHING` como `DO UPDATE` insertan el mismo default; la rama de conflicto no se ejecuta. El pgTAP puede devolver 10/10 aunque la política de no sobrescritura esté rota.

### Mutaciones que debe matar el próximo arreglo

- **M01:** quitar el insert objetivo completo → rojo.
- **M02:** cambiar el `DO NOTHING` real por `DO UPDATE` → rojo.
- **M03:** cambiar a `DO UPDATE` y dejar `-- on conflict (key) do nothing;` como comentario señuelo → rojo.
- **M04:** cambiar el insert objetivo a `DO UPDATE` y agregar un segundo insert irrelevante con `DO NOTHING` → rojo.

La solución esperada es limpiar comentarios SQL y validar las cinco parejas + la cláusula sobre **el único INSERT objetivo**, no sobre el archivo completo.
