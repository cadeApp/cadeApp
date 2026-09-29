# Revisión PR #128 — T-315

- PR: #128 `[T-315] Deploy a Vercel desde GitHub Actions`
- Rama: `feat/T-315-deploy-vercel`
- SHA revisado: `f0c613a8f47dd28d930e08dbc5b3bc328dfb2a86`
- Base: `develop@ffded647be7445b33092ccc76d26e78430ec87dd`
- Ronda actual: 3
- Estado: **SIN BLOQUEANTES**
- Decisiones cerradas: D01 = 1-A; D02 = 2-A.

## Resumen

T-315 queda técnicamente apta en el SHA revisado.

- **PR128-H01 cerrado/verificado:** producción usa `workflow_run.actor.login`, conserva `exit 1` para actor no autorizado y el control detecta volver a `triggering_actor`.
- **PR128-H02 cerrado/verificado:** `shellCommands()` valida comandos activos del bloque `run: |`; comentario de `pull`, negación del health y `echo` del build quedan RED. La batería independiente además pone RED al invertir `pull/build`, eliminar el deploy y volver a neutralizar health con `|| true`.
- **PR128-A01** sigue aceptado por decisión 1-A; no crea precedente general.
- La rama incorporó `develop@ffded647` por merge normal y quedó `ahead 6 / behind 0`.

## CI exacto del SHA revisado

Run CI **#606** sobre `f0c613a8f47dd28d930e08dbc5b3bc328dfb2a86`:

- `typecheck`: success
- `lint`: success
- `unit`: success
  - Vitest: **103 archivos / 1381 tests passed**
  - `verify-workflows.test.mjs`: **27 pass / 0 fail**
  - ADR tests: **6 pass / 0 fail**
- `build`: success
- `audit`: success
- `db-tests`: success
  - pgTAP: **Files=12, Tests=1601, Result: PASS**
  - `db:types` generó tipos con `--local` y el mismo step ejecutó `git diff --exit-code -- src/types/database.types.ts`.
- `bundle-budget`: success advisory. El log sigue mostrando rutas preexistentes sobre 180 kB (por ejemplo varias rutas admin a 236 kB y `/design-system` a 185 kB). T-315 no modifica código de producto ni bundle, por lo que no se abre hallazgo en esta PR.

## Evidencia independiente

Se reprodujeron las tres mutaciones declaradas por el autor:

- comentar `vercel pull` de staging → RED;
- `! curl --fail` → RED;
- reemplazar build por `echo "...build..."` → RED.

Batería propia, distinta:

- invertir `pull` y `build` → RED;
- eliminar el comando de deploy → RED;
- health con `|| true` → RED.

También se probaron `pull/build ... || true`; quedan GREEN porque agregan un invariante distinto —propagación explícita del fallo de esos dos comandos— que no forma parte del DoD de H02. No se usa esa ampliación para prolongar artificialmente el hallazgo.

## No revisado / operativo posterior

- El deploy real a Vercel solo puede ejercitarse después de mergear el workflow a la rama por defecto y promover a `staging`.
- La bitácora declara que producción todavía necesita la variable `PRODUCTION_APP_URL`; la revisión no lee ni modifica configuración/secrets externos. El workflow falla visible si falta.
- Esta revisión no aprueba ni mergea la PR.

## Veredicto

**SIN BLOQUEANTES.** H01 y H02 cerrados, A01 aceptado y sin decisiones pendientes.
