# Evidencia reproducible — PR #373 / CC-026 — ronda 1

**HEAD inspeccionado:** `eadaf54581b1c1cd3875e4a039ba66ffe70f0548`; **base develop:** `687e2043817340b2951714cb6e7b179be2e3973a`.

### Qué se consultó efectivamente

- GitHub PR metadata/diff `#373`, comentarios y CC desde `develop`; siete archivos cambiados, +160/-7 líneas.
- GitHub compare `develop...eadaf54581b1c1cd3875e4a039ba66ffe70f0548`: `ahead_by=1`, `behind_by=0`; ref/remoto coincide, PR Draft/mergeable.
- GitHub commit status: Vercel success; `e2e-preview` error por ejecución CANCELLED `38704263924`, no falla de test demostrada; CI main al momento de la ronda en progreso.
- **ANÁLISIS propio estático** sobre contenido de archivos reales: `RPC_CONTRACTS.reconcile_expired_requests.errorCodes` no contiene `VALIDATION_ERROR`; `callRequestRpc` devuelve ese código para parse inválido; output Zod no tiene `refine` ni `superRefine`; las suites nuevas sólo aportan un camino feliz de reconciliación.

**No** se ejecutaron Vitest, `node ... analizar.mjs`, Docker, pgTAP, `git merge-tree` o mutación real por imposibilidad de clonar desde este contenedor. La declaración RED/GREEN del autor no fue reproducida.

### Comandos para reproducir en el SHA limpio

```bash
set -euo pipefail
git fetch origin develop cc/CC-026-reconciliacion-expiraciones
git diff --stat origin/develop...eadaf54581b1c1cd3875e4a039ba66ffe70f0548
git diff --name-status origin/develop...eadaf54581b1c1cd3875e4a039ba66ffe70f0548
git merge-tree --write-tree origin/develop eadaf54581b1c1cd3875e4a039ba66ffe70f0548
git show origin/develop:docs/contracts/CC-026.md | sed -n '1,230p'
git diff origin/develop...eadaf54581b1c1cd3875e4a039ba66ffe70f0548 -- src/domain src/server/rpc docs/contracts/CC-026.md
git status --short
```

### Test de regresión requerido H01

En `src/server/rpc/requests.test.ts`, el mock de `client.rpc` no debe ser llamado ante input extra:

```ts
const rpc = vi.fn();
const client = createRequestsRpcServerClient({ rpc });
const response = await (client.reconcile_expired_requests as (v: unknown) => Promise<unknown>)({ merchantId: requestId });
expect(response).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
expect(rpc).not.toHaveBeenCalled();
expect(RPC_CONTRACTS.reconcile_expired_requests.errorCodes).toContain('VALIDATION_ERROR');
```

El `as` solo se usa en el test adversarial para escapar el tipado del caller y ejercer la validación runtime; no poner `as any` en producción.

### Test de regresión requerido H02

```ts
const base = {
  expiredRequestIds: [requestId],
  expiredCount: 1,
  hasMore: false,
};
expect(reconcileExpiredRequestsOutputSchema.safeParse(base).success).toBe(true);
expect(reconcileExpiredRequestsOutputSchema.safeParse({ ...base, expiredCount: 0 }).success).toBe(false);
expect(reconcileExpiredRequestsOutputSchema.safeParse({ ...base, expiredRequestIds: [requestId, requestId], expiredCount: 2 }).success).toBe(false);
```

Probar además `callRequestRpc` mockeando respuesta RPC con count=0/IDs=1: se espera `INTERNAL_ERROR`, sin success falso.

### Mutaciones RED de diseño del revisor — PENDIENTES DE EJECUCIÓN

No se afirma que se ejecutaron. Para ejecutarlas en una segunda ronda, construir en `/tmp` un harness que modifique **en memoria** la carga del módulo y restaure la fuente original, sin commit de mutaciones. Verificar:
1. Quitar `'VALIDATION_ERROR'` del catálogo tras corregir H01 ⇒ test nuevo cae.
2. Remover el refinamiento count-vs-IDs ⇒ test nuevo cae.
3. Desactivar `ALLOWED_ROLES_BY_RPC.reconcile_expired_requests` ⇒ test negativo de courier/admin cae.
4. Quitar `request.merchantId === actor.userId` ⇒ test de aislación entre comercios cae.
5. Sustituir `.slice(0, 50)` por la lista completa ⇒ test de 51 filas cae.

Cada control debe pasar GREEN sin mutación, luego RED por la violación **semántica** y GREEN después de revertir. No basta con errores de compilación; no se permite adulterar mocks, reducir expectations ni inventar ejecución.

### Suite exigida para terminar CC-026

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm exec vitest run src/domain/domain.test.ts src/server/rpc/requests.test.ts src/server/cron/sweep.test.ts
pnpm exec vitest run tools/verify-fichas.test.ts
# pgTAP en job db-tests CI del SHA vigente, con logs Files=/Tests=/Result: y build de tipos
# Concurrencia SQL: ejecutar el harness de dos conexiones autorizado en CI, no levantar Docker/Supabase local durante revisión
# Preview E2E: run nuevo concluido GREEN con SHA exacto; no contar CANCELLED como PASS
node docs/revision-pr/analizar.mjs verificacion
git diff --check
git status --short
```

## Ronda 2 — Consultas ejecutadas al SHA `f62a385c6e152ea206598aa3460eeec31f97b2a1`

**Fuente verificable:** GitHub connector, `get_pr_info`, `compare_commits`, `fetch_file`, GitHub Actions CI [run 38711509294](https://github.com/cadeApp/cadeApp/actions/runs/38711509294). No se ejecutó Docker, SQL remoto, ni tests locales del revisor.

### CI y resultados observados en el SHA exacto
- `lint`: SUCCESS; `audit`: SUCCESS.
- `typecheck`: FAILURE TS2345 en `src/server/cron/sweep.ts:73`: `reconcile_expired_requests_cron` no pertenece a los nombres generados en `Database['public']['Functions']`. `src/types/database.types.ts` sigue sin ambas nuevas firmas; `build` falla por lo mismo.
- `unit`: FAILURE 2240/2241 PASS; `src/app/api/cron/sweep/route.test.ts:199` espera HTTP 200 y recibió 500. `runSweep` usa `supabase.rpc('reconcile_expired_requests_cron', {p_limit:200})` pero fixture de route.test sigue exponiendo mock PostgREST de la fase vieja.
- `db-tests`: FAILURE; `supabase/tests/cc026_reconcile_expired_requests.sql` test 34 (`UPDATE delivery_requests.expires_at`) y test 36 (`UPDATE offers.decided_at`) recibieron SQLSTATE NULL cuando esperaban 42501. Estos son hallazgos de seguridad **realmente detectados por CI**. En `pg_temp.clear_requests` lineas 135-145 se elimina `delivery_requests` sin borrar primero `offers` => FK `offers_request_id_fkey` en línea 248, clave `...0004`.
- `Vercel`: FAILURE, `approval-policy`: FAILURE, `bundle-budget`: SKIPPED, `Supabase Preview`: SKIPPED.
- `db-tests` sí arrancó Postgres de CI; avisos transitorios de límite Docker Hub no impidieron llegar a pgTAP. El harness nuevo `supabase/tests/integration/cc026_reconcile_expired_requests.mjs` **NO** está en los comandos del job `.github/workflows/ci.yml:186-195`. El autor tampoco declaró haberlo ejecutado.

### Diagnósticos por inspección
```sql
-- RED ya demostrado en CI, reproducir y luego GREEN sin rebajar assertions:
-- actor merchant autenticado sobre solicitud propia:
update public.delivery_requests set expires_at = now() where id = '<ID_PROPIO>';
-- actor courier autenticado sobre oferta propia:
update public.offers set decided_at = now() where id = '<ID_OFERTA_PROPIA>';
```
Verificar además la fila `OLD/NEW` persistida y que se deniega el intento mediante `42501` u otro error SQL legítimo establecido por la barrera nueva, sin aceptar éxito silencioso. El test debe ejecutar el `UPDATE` contra una fila visible/autorizada al SELECT, no contra 0 rows invisibles.

```bash
# Reproducciones para el autor en su propio worktree (NO ejecutadas por el revisor):
pnpm exec vitest run src/app/api/cron/sweep/route.test.ts src/server/cron/sweep.test.ts
pnpm typecheck && pnpm lint && pnpm test
pnpm supabase test db supabase/tests/cc026_reconcile_expired_requests.sql
# Tras restaurar DB local de CI: ejecutar harness con DB_CONTAINER real
DB_CONTAINER="$DB_CONTAINER" node supabase/tests/integration/cc026_reconcile_expired_requests.mjs
pnpm db:types --local
git diff --exit-code -- src/types/database.types.ts
node docs/revision-pr/analizar.mjs verificacion
```

### Casos adversariales pedidos, NO ejecutados
1. Crear oferta con `decided_at` pendiente y alterar directamente fecha por JWT courier: test revierte al salir del scope y demuestra denegación efectiva; mutation de quitar barrera debe volverlo rojo.
2. Reactivar UPDATE directo `expires_at` como merchant: test debe fallar RED si quitan la barrera.
3. `cc026_reconcile_expired_requests.mjs` debe ejecutarse en CI; test negativo de SQL inválido dentro de sesión PsqlSession debe dar FAILURE (el actual `ON_ERROR_STOP=0` permite continuar luego de errores).
4. Con >200 solicitudes vencidas, `runSweep` debe avanzar por batches hasta presupuesto sin ignorar `hasMore`; el counter y los IDs nunca cuentan filas no actualizadas; sin bucle infinito ante locked-only.
5. Romper `rpc('reconcile_expired_requests_cron')` en el mock de route.test: fixture debe hacer fallar el HTTP 200 e incluir un caso 500 por `{error}`; prohibido forzar `GET` a 200 o suprimir assertions.
6. Eliminar el helper SQL y asegurar pgTAP RED (sin falsos checks de presencia por texto); cubrir concurrencia real en DB con su shell CI y resultados explícitos.

## Ronda 3 · SHA inspeccionado `f30193d6c633589390b22276cbc09a3bf7d31d2c`

**Consultas efectivas del revisor:** GitHub compare `ddf6524...f30193d` (1 commit, 7 rutas), PR metadata y body, archivos de `supabase/migrations`, `supabase/tests`, `src/server/cron`, `src/app/api/cron/sweep/route.test.ts`, GitHub Actions CI `38761492563` en el HEAD exacto. No se ejecutaron `git`, `node`, `vitest`, `psql`, `docker` ni mutaciones localmente (no hay clon; GitHub DNS inaccesible en este contenedor); sólo consultas de archivos y resultados CI vía conector.

**Run [CI 38761492563](https://github.com/cadeApp/cadeApp/actions/runs/38761492563):**
- `lint` y `audit` SUCCESS.
- `typecheck` FAILURE `src/server/cron/sweep.ts:79` TS2345, nombre de RPC cron no existe en types.
- `build` FAILURE por el mismo tipo.
- `unit` FAIL de cobertura **después** de `Test Files 133 passed / Tests 2347 passed`: `rpc-fake.ts` branches 89.94% versus 90%.
- `db-tests` FAIL: `supabase/tests/cc026_reconcile_expired_requests.sql:276` `ERROR function like(text, unknown, unknown) does not exist`. El archivo `Tests: 41 Failed: 0` **no es PASS**, abortó tras el caso 41.
- `approval-policy` FAIL; Vercel FAIL; `bundle-budget` SKIPPED; `Supabase Preview` SKIPPED; sin E2E Preview verde observado.
- T-366 issue #355 estaba `en-curso` incorrectamente; vuelto a `bloqueada` manteniendo responsable KiraK72.

**Reproducciones solicitadas al autor, no ejecutadas por revisor:**
```bash
pnpm supabase test db supabase/tests/cc026_reconcile_expired_requests.sql
pnpm exec vitest run src/domain/domain.test.ts src/server/rpc/requests.test.ts src/server/cron/sweep.test.ts src/app/api/cron/sweep/route.test.ts
pnpm test
pnpm typecheck && pnpm lint
# En CI db-tests, tras autorización de scope:
DB_CONTAINER="$DB_CONTAINER" node supabase/tests/integration/cc026_reconcile_expired_requests.mjs
# Tras migración en entorno local de generación autorizado, NO editar tipos a mano:
pnpm db:types --local
git diff --exit-code -- src/types/database.types.ts
node docs/revision-pr/analizar.mjs verificacion
git diff --check
```

**Script de mutación RED propuesto, NO EJECUTADO (no se declara GREEN):**
```js
// test de mutación en memoria con copia del código fuente en /tmp fuera de la rama,
// a ejecutar por revisor con clon disponible, sin cambiar tests/expectations:
const mutations = [
  { file: 'src/domain/testing/rpc-fake.ts', from: 'request.merchantId === actor.userId &&', to: 'true &&' },
  { file: 'src/domain/testing/rpc-fake.ts', from: 'request.acceptedOfferId === null &&', to: 'true &&' },
  { file: 'src/domain/testing/rpc-fake.ts', from: 'eligible.slice(0, 50)', to: 'eligible' },
];
for (const m of mutations) {
  // Harness requerido: compilar código con transformación en memoria + inyectar
  // en Vitest o ejecutar un worktree efímero sin tocar el source original;
  // cada caso se registra RED → restaurar original → GREEN.
  // No confundir este diseño con una mutación independiente ejecutada.
}
```

## Ronda 4 — HEAD inspeccionado `23e394f828df3872a5681c4cdadf2da9eb3db399`

**Consultas hechas:** GitHub PR #373 metadata (Draft, reviewer solicitada por comentario), comparación `07a7a381...23e394f8` (4 commits, 7 rutas); diff completo 23 rutas; fuente contractual `docs/contracts/CC-026.md` y ficha T-366 desde develop; GitHub Actions logs exactos del HEAD run [38783733680](https://github.com/cadeApp/cadeApp/actions/runs/38783733680); status e2e-preview en el HEAD; aprobación run [38784748063](https://github.com/cadeApp/cadeApp/actions/runs/38784748063).

**CI directo observado:**
```text
unit: Test Files 133 passed (133); Tests 2348 passed (2348)
db-tests: Files=23, Tests=2259; Result: PASS
cc026 pgTAP: Files=1, Tests=54; Result: PASS
cc026 pgTAP mutation: 8/54 FAIL [42-49], RED reconocido por CI
cc026 pgTAP after restore: 54/54 PASS, GREEN reconocido por CI
cc026 harness: [CC-026] GREEN: dos lectores, aceptación y republicación se serializan sin expiraciones parciales.
db-types: generated-database-types artifact 11995924838; git diff --exit-code -- src/types/database.types.ts PASS
approval-policy: Falta el informe completo de revisar-pr sin bloqueantes.
e2e-preview: ERROR / BLOCKED / REQUIRES DEVELOP MIGRATION [dpl_KFLxJ7TFSyNrnQf9yxKwVbMtGzMJ]
```

**No ejecutados por el revisor:** mutaciones locales independientes, `git merge-tree`, `pnpm test`, `pnpm supabase test db`, `docker`, consultas contra Supabase remoto, `node docs/revision-pr/analizar.mjs verificacion`. No se deben presentar como hechos. PR API indicó mergeable=true; no certifica ausencia de conflicto por `git merge-tree`.

**Responsabilidad humana:** en R3 se preguntó D1/D2 y se recomendaron A/A, pero no se localizó una elección explícita en comentarios issue #371/PR #373; cuerpo de PR declara “autorización posterior” sin evidencia de selección. No deshacer archivos automáticamente; solicitar ratificación o abrir PR separado. La revisión corrigió metadata del issue #355 de `en-curso` a `bloqueada` preservando @KiraK72.
