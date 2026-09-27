# Informe de Revisión — PR #82 — Ronda 10

- **Tarea:** `T-204`
- **SHA revisado:** `8cf71edf08c4d996b9125ca2d01b8deb2852ae4f`
- **develop:** `7f392e9f0fc020f9dcf6838d1638cbbe4004d7ac`
- **Resultado:** ❌ **CON BLOQUEANTES (1)** · 0 decisiones pendientes

## Preflight

- Merge `bd519acc` integra develop actual (CC-011/mapa y lockfile).
- Fix propio T-204: `39b8dd2` + bitácora `8cf71ed`.
- Rama: behind 0.
- Archivos de CC-011/package son del merge de develop, no OOS del autor.

## Cierre de R9

### PR82-H31 — arreglado/verificado

CI exact-head run `36302911020`:

```text
/courier/feed   175 kB | OK
/courier/offers 159 kB | OK
```

El build real compila 42/42 rutas. Los hooks cargan los schemas Zod mediante `import('@/lib/live-contracts')` dentro de `queryFn`, conservando validación de frontera sin cargar Zod en el initial chunk.

### PR82-H32 — arreglado/verificado

CI exact-head:

```text
Test Files 76 passed (76)
Tests      872 passed (872)
```

Suites antes rojas:
- use-request-offers: 14/14
- use-available-requests: 13/13
- request-offers component: 9/9
- use-trip: 11/11
- use-realtime-invalidation: 7/7

## PR82-H33 — BLOQUEANTE

Ambas páginas tienen:

```ts
// eslint-disable-next-line boundaries/entry-point
import { ... } from '@/features/offers/components/...';
```

Esto contradice directamente `AGENTS.md §4`:

> Prohibido: ... desactivar reglas de lint o checks.

Y `.eslintrc.json` configura `boundaries/entry-point` para features con entrada permitida únicamente por:
- `index.ts`
- `server.ts`

El lint queda verde precisamente porque se silenció la regla.

**Origen del hallazgo:** revisión. La Ronda 9 indicó imports directos para optimizar bundle sin contemplar la regla de entry point. El autor siguió esa instrucción; R10 corrige ese conflicto.

### Corrección esperada

- Quitar ambos comentarios `eslint-disable-next-line boundaries/entry-point`.
- Volver a:
  - `import { CourierFeed } from '@/features/offers';`
  - `import { MyOffersList } from '@/features/offers';`
- Mantener los dynamic imports Zod que cerraron H31.
- Medir nuevamente. La aceptación sigue siendo:
  - `/courier/feed <= 180 kB`
  - `/courier/offers <= 180 kB`
- Si el barrel vuelve a exceder 180 kB, no silenciar lint ni modificar fronteras: reportar el tamaño real para nueva revisión.

## CI exact-head — run 36302911020

- typecheck ✅
- lint ✅ (pero H33 hace que este verde no sea suficiente)
- unit ✅ — 76 suites / 872 tests
- db-tests ✅
- audit ✅
- build ✅ — 42/42
- bundle-budget ✅ — rutas T-204 dentro de 180 kB

No se aprueba ni mergea en esta ronda.
