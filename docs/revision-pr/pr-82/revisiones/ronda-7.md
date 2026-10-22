# Informe de Revisión — PR #82 — Ronda 7

- **Tarea:** `T-204`
- **Autor:** `asako669` (P2)
- **SHA revisado:** `10e25ff57dd449ab20135ebfba8675aa6e23bda1`
- **develop actual:** `ef09bb8ec9fa2335aa6e9e7ae11165301841a61d`
- **Resultado:** ❌ **CON BLOQUEANTES (4)** · 0 decisiones pendientes

## Preflight

- 2 commits nuevos desde R6: `e221c46` (H28) + `10e25ff` (bitácora).
- El diff de H28 toca 27 archivos y queda dentro del scope D04 autorizado.
- El autor no escribió `docs/revision-pr/pr-82/**`.
- La rama quedó `ahead 24 / behind 2` porque develop incorporó T-115 y T-122.

## H28 — estado

La paginación sí está implementada en sus cuatro capas:

- contratos `{data,nextCursor}`;
- server keyset `created_at DESC, id DESC`, `limit(51)`, corte a 50;
- SSR inicial paginado;
- hooks con `useInfiniteQuery`;
- UI «Cargar más»;
- índices keyset.

CI exact-head/merge-ref confirma `unit` ✅ (75 suites / 834 tests) y `db-tests` ✅; la migración `20260926173000_t204_live_pagination_indexes.sql` se aplica y la matriz RLS pasa. H28 queda **parcial** porque el endpoint no llega a un build productivo válido por R01 y la evidencia de mutaciones tiene defectos en H29.

## BLOQUEANTES

### PR82-R01 — regresión H22 / Route Handler inválido

`src/app/api/live/available-requests/route.ts` declara:

```ts
export async function GET(request?: NextRequest | Request)
```

Next 15 rechaza `undefined` como primer argumento. CI run `36270647334`:

```text
Failed to compile.
Route src/app/api/live/available-requests/route.ts has an invalid GET export:
Type NextRequest | Request | undefined is not a valid type for the function's first argument.
Next.js build worker exited with code: 1
```

El test sin cursor llama `GET()` y empujó producción a aceptar un caso que el framework no permite.

### PR82-R02 — `any` + non-null assertions reintroducidos en tests

En `src/server/live/t204.test.ts` el diff nuevo agrega:

```text
then: (resolve: (val: any) => any, reject?: (reason: any) => any) => Promise<any>
const builder: any
rows51[49]!
rows51[50]!.id
offers51[49]!
```

Es una regresión de la clase H18 y viola la regla de calidad de la skill.

### PR82-H29 — evidencia A/F/build no reproducible

- F describe índices `idx_delivery_requests_published_keyset` y `idx_offers_request_keyset` con `IF NOT EXISTS`; el SQL real usa `delivery_requests_published_cursor_idx` y `offers_request_created_cursor_idx`, sin `IF NOT EXISTS`.
- A dice que `limit(51) -> limit(50)` produce `nextCursor:null`; el mock actual no aplica el límite a los datos y siempre entrega las 51 filas. Esa causa no puede generar el rojo narrado.
- La sesión declara `pnpm build` verde, pero el CI exact-head muestra el fallo de R01.

No se acepta esa evidencia como mutación válida.

### PR82-H30 — drift de 2 commits

develop actual: `ef09bb8`; rama: `10e25ff`; `behind 2`. Debe hacerse `git merge origin/develop` antes del arreglo final, nunca rebase.

## CI

Run `36270647334` sobre el merge ref:

- unit ✅ — 75 suites / 834 tests
- typecheck ✅
- lint ✅
- db-tests ✅ — migraciones + RLS PASS
- audit ✅
- build job figura ✅ por `tee`, pero **`next build` interno ❌ exit 1**
- bundle-budget ❌ porque el artifact no contiene rutas

## Decisiones

No hay ítems 🔵 pendientes.
