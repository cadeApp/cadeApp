# Evidencia y comandos reproducibles — PR #455 / T-385

**HEAD de inspección:** `cffb9ff62d98eba993a2e14124afa639cdce709a`  
**Límite importante:** acceso de lectura mediante GitHub; desde este entorno `git ls-remote` falló por DNS. No se ejecutaron las mutaciones independientes aquí. Se distinguen comandos **propuestos** y CI **observado**.

## Validaciones oficiales observadas (no reproducidas por el revisor)

- CI run 39386300478; `db-tests` job 118506849725, `unit` job 118506849706.
- pgTAP CC-034 `ok` (log del job `db-tests`), `Result: PASS` final.
- `[CC-034] Escenario 1/2/3 GREEN`.
- `[CC-034] Control de mutación RED confirmado: sin "for update" la auditoría se duplica.`
- `[CC-034] Control de mutación GREEN confirmado: con la migración original vuelve a 1 sola auditoría.`
- `unit`: `Test Files 149 passed (149)`, workflow tests `pass 79`, ADR `pass 6`.
- `approval-policy`: failure (falta informe independiente).

## H01 · script autocontenido para reproducir el contraejemplo

Copiar íntegro a `/tmp/pr455-h01.sh` y ejecutar desde la raíz de un worktree limpio en el SHA a comprobar. Solo crea un archivo de test temporal, que elimina al salir. **En el HEAD de ronda 1 se espera RED** y después del arreglo GREEN.

```bash
#!/usr/bin/env bash
set -euo pipefail
test_file="src/domain/cc034-review-available.test.ts"
if test -e "$test_file"; then
  echo "ERROR: ya existe $test_file, no sobrescribir"; exit 2
fi
trap 'rm -f "$test_file"' EXIT
cat > "$test_file" <<'TS'
import { describe, expect, it } from 'vitest';
import { createFakeRpcClient } from './testing/rpc-fake';
const ADMIN = '30000000-0000-4000-8000-0000000034a1';
const COURIER = '20000000-0000-4000-8000-0000000034c2';
const settings = {
  minOfferArs: 1200,
  maxOffersPerMin: 10,
  maxRequestPublicationsPerMin: 10,
  maxIncidentsPerMin: 5,
  requestTtlMinutes: 25,
  pilotActive: true,
  pilotTermsVersion: 'v1.0',
  subscriptionGraceDays: 3,
};
describe('PR455-H01 — CC-034 disponibilidad intacta', () => {
  it('la RPC fake no escribe available aunque el valor previo no sea el habitual', async () => {
    const client = createFakeRpcClient({
      settings,
      initialActor: { userId: ADMIN, role: 'admin', aal: 'aal2' },
      initialCouriers: [
        { courierId: COURIER, status: 'rejected', available: true, vehicleType: 'bike' },
      ],
    });
    expect(client.getCourier(COURIER)?.available).toBe(true);
    const response = await client.admin_reinstate_courier({ courierId: COURIER, reason: 'Revisado' });
    expect(response).toEqual({
      ok: true,
      data: { courierId: COURIER, previousStatus: 'rejected', status: 'approved', idempotent: false },
    });
    expect(client.getCourier(COURIER)).toMatchObject({ status: 'approved', available: true });
  });
});
TS
pnpm exec vitest run "$test_file"
```

Para revalidar el test como control negativo después del arreglo, reintroducir **solo temporalmente y en copia descartable** la línea `courier.available = false` en la función fake, correr el mismo arnés y comprobar que el test falle. Restaurar la copia del código **en memoria o desde un worktree efímero limpio**, sin usar `git checkout` para mutaciones.

## H02 · test SQL necesario y control negativo

En `supabase/tests/cc034_admin_reinstate_courier.sql`, insertar **justo antes** de `select pg_temp.act_as(pg_temp.admin_a(), 'aal2');` en la sección 6, todavía con el rol postgres:

```sql
create table pg_temp.reinstate_before_retry as
select ctid::text as tuple_id
from public.couriers where profile_id = pg_temp.courier_susp();
```

Inmediatamente después del retorno idempotente y del `pg_temp.reset_actor()`, agregar:

```sql
select is(
  (select ctid::text from public.couriers where profile_id = pg_temp.courier_susp()),
  (select tuple_id from pg_temp.reinstate_before_retry),
  'approved idempotente no hizo UPDATE físico de couriers'
);
```

Aumentar `plan(49)` a `plan(50)` con esta aserción (o al valor final exacto si se agregan más).

**Mutación RED independiente a ejecutar en base efímera de CI, nunca en remoto ni Docker local:**

1. Confirmar pgTAP original GREEN contra la función original.
2. Crear una copia temporal de la migración, sustituyendo **solamente** el inicio del caso `if v_courier_status = 'approved' then` por ese mismo bloque más `update public.couriers set available = available where profile_id = p_courier_id;` antes del `return`.
3. Instalar esa función temporal **solo en la base efímera de CI**; correr pgTAP original y exigir fallo **en la aserción del ctid**, no por otro error.
4. Restaurar la función original usando la migración original sin modificar el archivo trackeado. Correr el mismo pgTAP y exigir GREEN.
5. Guardar salidas resumidas de RED y GREEN en `docs/tasks/log/T-385.md` (el agy), sin reclamar que la revisión las ejecutó.

No tocar `.env*`, secretos, Supabase remoto ni workflow de forma manual. No crear tests tautológicos, eliminar assertions ni adulterar expectativas.

## Verificaciones después de arreglos

```bash
pnpm exec vitest run src/domain/cc034-admin-reinstate-courier.test.ts src/server/rpc/admin.test.ts
pnpm typecheck
pnpm lint
pnpm test
git diff --check
git status --short
```

`db-tests` (incluido pgTAP, drift y CC-034 concurrente) se lee del pipeline oficial del SHA de corrección. No iniciar Docker ni Supabase local. Ningún resultado del bloque anterior se afirma como ejecutado por esta revisión.

---

## Evidencia observada — ronda 2 (2026-10-20)

**Código de corrección:** `0870a9ce94378a5cb2d21db5a9b3d4ab5b453860`  
**Último HEAD al examinar:** `208fbf7e341fb907edc5ebf5ec8d6b9b90476e8c`

### Alcance mecánico

```text
a412cb19..0870a9ce:
  src/domain/testing/rpc-fake.ts                     -1
  src/domain/cc034-admin-reinstate-courier.test.ts   +22
  supabase/tests/cc034_admin_reinstate_courier.sql   +9/-1

0870a9ce..208fbf7e:
  docs/tasks/log/T-385.md                            +19

0870a9ce..36f0ab6 (#456 cerrada, NO MERGE):
  supabase/migrations/20261020113000_cc034_admin_reinstate_courier.sql +2/-0
```

### H01: contraste RED comunicado con GREEN oficial

**Lo comunicado por el autor (bitácora; no reproducido por el revisor):**
```text
Tests 1 failed | 7 passed (8)
expected false to be true
Tests 8 passed (8)
```

**CI verificado por lectura independiente de job `unit` 118514448261, run 39388538108, HEAD `0870a9ce94378a5cb2d21db5a9b3d4ab5b453860`:**
```text
src/domain/cc034-admin-reinstate-courier.test.ts (8 tests)
Test Files 149 passed (149)
Tests 2907 passed (2907)
# pass 79
# pass 6
```

### H02: mutación real aislada RED en #456

**Fuente:** https://github.com/cadeApp/cadeApp/pull/456 — `36f0ab6f521849aa9602b6b1e81d546c85050f61`, parent directo `0870a9ce94378a5cb2d21db5a9b3d4ab5b453860`. Solo altera función SQL y NO se mergeó.

**Job `db-tests` 118514301969 (run 39388573174):**
```text
# Failed test 38: "approved idempotente no hizo UPDATE físico de couriers"
#         have: (0,75)
#         want: (0,74)
supabase/tests/cc034_admin_reinstate_courier.sql (Wstat: 0 Tests: 50 Failed: 1)
Files=32, Tests=2918
Result: FAIL
```

**Job `db-tests` 118514448356 de la PR real (`0870a9ce94378a5cb2d21db5a9b3d4ab5b453860`), run 39388538108:**
```text
supabase/tests/cc034_admin_reinstate_courier.sql ....... ok
Files=32, Tests=2918
Result: PASS
[CC-034] Escenario 1 GREEN
[CC-034] Escenario 2 GREEN
[CC-034] Escenario 3 GREEN
[CC-034] Control de mutación RED confirmado: sin "for update" la auditoría se duplica.
[CC-034] Control de mutación GREEN confirmado: con la migración original vuelve a 1 sola auditoría.
```

**Nota sobre ejecución:** los extractos anteriores provienen de logs de GitHub Actions, leídos por este revisor. No son salida de una ejecución local de revisor. La rama #456 aporta una mutación independiente del código original, **pero fue creada por el autor**, no por esta revisión.

### Comandos de inspección sugeridos para quien quiera repetir localmente

```bash
git fetch origin
git diff --name-status a412cb1913a15aee34d54f7da7eb66c4eab17bcf 0870a9ce94378a5cb2d21db5a9b3d4ab5b453860
git diff --name-status 0870a9ce94378a5cb2d21db5a9b3d4ab5b453860 208fbf7e341fb907edc5ebf5ec8d6b9b90476e8c
git diff --check origin/develop...208fbf7e341fb907edc5ebf5ec8d6b9b90476e8c
pnpm exec vitest run src/domain/cc034-admin-reinstate-courier.test.ts src/server/rpc/admin.test.ts
node docs/revision-pr/analizar.mjs verificacion
```

No se ejecutaron aquí por falta de clon y resolución DNS de GitHub. No abrir Docker/Supabase local. No son tareas necesarias solo para documentación.
