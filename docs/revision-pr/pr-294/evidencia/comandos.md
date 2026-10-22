# Evidencia — PR #294

HEAD revisado: `a0d860d46d96f1a03851cc2ffd2f17923c12aae0`.

## Integración

```text
develop = a773c05cc488a1fc60bfb36512cdca35d12d1271
HEAD    = a0d860d46d96f1a03851cc2ffd2f17923c12aae0
ahead   = 2
behind  = 0
```

## H01

```text
e2e-mutation.yml
65  Install dependencies
68  pnpm install --frozen-lockfile
79  Control run
86  SUPABASE_SERVICE_ROLE_KEY
88  DNI_HMAC_SECRET
89  CRON_SECRET
103 Mutant run
111 SUPABASE_SERVICE_ROLE_KEY
113 DNI_HMAC_SECRET
114 CRON_SECRET
```

No existe sandbox entre el checkout `target/` y el proceso trusted del runner.

Decisión de Lautaro073: `A — solo target=develop`.

## H02

```text
e2e-mutation.mjs
565 function run(...)
568 createWriteStream(logPath)
571 spawn(... env: process.env ...)
574 log.write(chunk)
578 log.write(chunk)

e2e-mutation.yml
132 upload-artifact
137 $RUNNER_TEMP/e2e-mutation/
138 !$RUNNER_TEMP/e2e-mutation/**/.env*
```

No se ejecutó exfiltración real; la prueba del defecto es el flujo de datos.

## M01

Ficha: `e2e-mutation-<id>-<sha7>`.
YAML: nombre con SHA completo.

## CI exact-head

```text
CI 37590329884
lint success
typecheck success
build success — 25.7s
unit success — 123/123 files, 1941/1941 tests
verify-fichas 7/7
verify-workflows 72/72
ADR 6/6
db-tests 19 files / 1853 tests PASS
db-types no drift
audit success
bundle-budget success advisory
Vercel success

E2E 37590661055
TARGET_SHA a0d860d46d96f1a03851cc2ffd2f17923c12aae0
43 passed
3 passed
trusted E2E gate GREEN
```
