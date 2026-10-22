# Informe de Revisión — PR #82 — Ronda 8

- **Tarea:** `T-204`
- **SHA revisado:** `a3407452cee9de01492bd4b2858b4667b2b36608`
- **develop:** `ef09bb8ec9fa2335aa6e9e7ae11165301841a61d`
- **Resultado:** ❌ **CON BLOQUEANTES (1)** · 0 decisiones pendientes

## Preflight

- Merge `1321f2d` integra los 2 commits que faltaban de develop.
- Fix propio `a7e713a` + bitácora `a340745`.
- Rama actual: ahead 27 / behind 0.
- Los archivos importados de T-115/T-122 son del merge de develop, no OOS del autor.

## Cierre de R7

- **H28 — arreglado/verificado:** paginación end-to-end presente; CI unit + build + db-tests/RLS verdes.
- **R01 — arreglado/verificado:** ambos Route Handlers usan `NextRequest` obligatorio. `next build` real compila y genera 42/42 rutas.
- **R02 — arreglado/verificado:** t204.test no contiene `any` ni non-null assertions reales; 22/22 tests en CI.
- **H29 — arreglado/verificado:** la evidencia A/F ahora corresponde al árbol; el test permanente de índices corre en CI y el call-log exige limit(51).
- **H30 — arreglado/verificado:** behind 0.

## CI exact-head — run 36272584952

- typecheck ✅
- lint ✅
- unit ✅ — 75 suites / 835 tests
- db-tests ✅
- audit ✅
- next build real ✅ — `Compiled successfully`, 42/42
- bundle-budget job ✅, pero contiene warnings de presupuesto.

## BLOQUEANTE

### PR82-H31 — regresión de First Load JS en rutas courier

La regla 25 §6 fija **hasta 180 kB** por ruta de comercio/repartidor.

Comparación reproducible:

```text
Baseline sin T-204 — PR #106 CI run 36264052134:
/courier/feed   179 kB  OK
/courier/offers 179 kB  OK

T-204 a340745 — CI run 36272584952:
/courier/feed   273 kB  Supera el límite
/courier/offers 273 kB  Supera el límite
```

Regresión: **+94 kB** en ambas rutas.

Cadena observada:

```text
CourierFeed
 -> useAvailableRequests
 -> useRealtimeInvalidation
 -> import estático '@/lib/supabase/browser'

/courier/offers
 -> import { MyOffersList } from '@/features/offers'
 -> barrel también exporta CourierFeed
 -> mismo grafo eager
```

El arreglo debe sacar Supabase browser del **initial chunk** sin quitar Realtime: carga diferida dentro del effect de `useRealtimeInvalidation`. No se acepta desactivar Realtime, quitar useInfiniteQuery ni subir el presupuesto.

El checker de bundle hoy solo advierte y devuelve SUCCESS; por eso CI verde no cierra este hallazgo.
