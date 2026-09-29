# Evidencia reproducible — PR #132

## Ronda 1

SHA revisado: `5daa66074efb5c8e197ecdb24370c37a9badaeb1`.

La evidencia completa de R1 queda preservada en `revisiones/ronda-1.md`. El fallo original del deploy fue:

```
Error: Hobby accounts are limited to daily cron jobs.
This cron expression (*/10 * * * *) would run more than once per day.
```

La batería independiente de R1 dejó GREEN mutaciones de concurrency, guard, production y cron inválido; eso originó H01.

---

## Ronda 2

SHA revisado: `0f12b80b22c89a33d61f25f2a7111c1e668f7600`.

### Alcance del arreglo

Desde el commit de revisión R1 `ade309ca`, el autor modificó únicamente:

```
.github/workflows/verify-workflows.test.mjs
docs/tasks/T-316.md
docs/tasks/log/T-316.md
```

`health-cron.yml` y `vercel.json` conservan sus blobs originales.

### Reproducción independiente de RED

Harness independiente que replica las propiedades del test del SHA:

```
baseline: GREEN

Autor:
cancel-in-progress false -> true: RED
group fijo -> group por run_id: RED
remove staging guard: RED
remove production Authorization: RED
remove production --fail: RED
cron 99 99 * * *: RED
production exit 1 -> exit 0: RED

Revisión:
production APP_URL -> literal: RED
remove production CRON_SECRET env: RED
production guard -z -> -n: RED
staging curl before guard: RED
cron minute 60: RED
cron hour 24: RED
cron boundary 59 23: GREEN
```

La combinación borde positivo + valores inmediatamente fuera de rango comprueba 0–59 / 0–23 sin sobreajuste al literal `99`.

### CI exacto

Run CI **#614** sobre `0f12b80b22c89a33d61f25f2a7111c1e668f7600`.

Job unit:

```
Test Files 103 passed (103)
Tests      1381 passed (1381)

verify-workflows:
# pass 29
# fail 0

ADR:
# pass 6
# fail 0
```

Job db-tests:

```
Files=12, Tests=1601
Result: PASS
[db:types] Ejecutando: pnpm supabase gen types typescript --schema public --local
[db:types] Tipos generados exitosamente ...
```

El mismo step contiene `git diff --exit-code -- src/types/database.types.ts` y terminó success.

Jobs:

```
typecheck     success
lint          success
unit          success
build         success
audit         success
db-tests      success
bundle-budget success
```

### Bundle budget

Se leyó el log. Continúan rutas preexistentes sobre 180 kB (varias rutas admin, `/design-system`, `/login/mfa`). T-316 no modifica producto ni bundle; no se abre hallazgo.
