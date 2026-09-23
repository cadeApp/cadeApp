# PR #62 — T-101 · `submit_offer`, `withdraw_offer`, `set_availability` y `rate_limits` atómico

> ❌ **Con bloqueantes · 1 bloqueante · 3 mejoras · 13 de 19 cerrados**
> ⚠️ **Revisión estática**: a pedido de Lautaro073 no se corrieron suites ni se consultó CI.

| | |
|---|---|
| **PR** | [#62](https://github.com/cadeApp/cadeApp/pull/62) · `feat/T-101-rpc-offers-rate-limits` → `develop` |
| **Tarea / issue** | [`T-101`](../../tasks/T-101.md) · Issue #11 |
| **Autor** | Lautaro073 (agy) |
| **Revisión** | independiente — no es el agy que implementó |
| **SHA revisado** | `15e9b72` · base `origin/develop` = `ddef51a` |
| **Alcance** | 16 archivos · **0 fuera** de «Archivos permitidos» |

## Rondas

| Ronda | SHA | Fecha | Resultado | Informe |
|---|---|---|---|---|
| 1 | `ee247ac` | 2026-09-23 | ❌ 2 bloqueantes · 7 mejoras · 4 decisiones | [`ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `15e9b72` | 2026-09-23 | ❌ 1 bloqueante · 3 mejoras · 2 decisiones | [`ronda-2.md`](revisiones/ronda-2.md) |

## Resumen

La implementación SQL es sólida: las tres funciones son `security definer` con `set search_path = public,
pg_temp`, los privilegios se revocan y se regrantan explícitamente, el upsert de `rate_limits` es genuinamente
atómico sobre la PK `(subject, action, window_start)`, y el piso de oferta sale de `platform_settings` como manda
`AGENTS.md` §2. El cruce mecánico contra `rpc-contracts.ts` da **exacto** en `submit_offer` (12/12) y
`set_availability` (6/6).

Los dos bloqueantes de la ronda 1 se cerraron: `max_offers_per_min` existe y se lee, y `CC-001` agregó
`INTERNAL_ERROR` a las tres RPC. Lo que queda es que el fake de dominio y la RPC todavía no son el mismo
contrato.

## Estado por hallazgo

### Cerrados en la ronda 2, verificados en `15e9b72`

`H01` · `H02` · `H03` · `H04` · `H05` · `H06` · `H07` · `H08` · `H09` — y las cuatro decisiones `D01`–`D04`,
aplicadas y citadas línea por línea en la ficha.

Tres se cerraron con más de lo pedido: el test 4 (`H05`) quedó mejor que el barrido con el que lo encontré, la
conducta aceptada de `H03` quedó congelada por un test que falla si cambia —demostrado en rojo antes, en su
propio commit `b0e969b`— y el test 33, que nadie pidió, es el que prueba que el tope sale de verdad de
`platform_settings`.

### Abiertos

| id | sev | archivo | qué |
|---|---|---|---|
| `H10` | **alto** | `rpc-fake.ts:506` | La RPC y el fake devuelven **códigos distintos para las mismas entradas**: validan en otro orden. Seis combinaciones discrepan; tres las ensanchó el arreglo de `H09` |
| `H11` | medio | `rpc-fake.ts:35` | El fake no implementa rate limiting: `RATE_LIMITED` es inalcanzable ahí y `FakePlatformSettings` no conoce `maxOffersPerMin` |
| `H12` | bajo | `rpc_offers.sql:321` | Numeración duplicada en los comentarios: 32 y 33 aparecen dos veces |
| `H13` | bajo | `CC-001.md` | Lleva tildada una aprobación de P2, que no revisa PRs |

### Decisiones

| id | qué | decisión |
|---|---|---|
| `D01`–`D04` | ronda 1 | **aplicadas** |
| `D05` | Precedencia de errores entre la RPC y el fake | **fijar la de la RPC como canónica** y alinear el fake, ampliando `CC-001` |
| `D06` | El fake y el rate limit | **sumar `maxOffersPerMin` y el contador** al fake, dentro de `CC-001` |

## El dato de la ronda

Los nueve hallazgos de la ronda 1 están cerrados. Lo que queda es de una sola naturaleza: **el fake y la RPC no
son el mismo contrato todavía**. Y una parte la produje yo: al pedir `H09` adelanté el piso y el rate limit
respecto de la validación de la solicitud, lo que agregó tres combinaciones divergentes. La parte vieja se me
había pasado en la ronda 1 porque comparé los *conjuntos* de códigos por función y no el *orden*.

## Lo verificado (todo estático)

| | |
|---|---|
| Alcance | ✅ 16 archivos, 0 fuera; la ficha se amplió citando `D02`, `D03` y `D01`/`D04` línea por línea |
| Construcciones prohibidas | ✅ 0 `any` · 0 `@ts-ignore` · 0 `!` · 0 `.only` · 0 `.skip` |
| `"use client"` en `src/server/` | ✅ ninguno |
| `security definer` + `search_path` por función | ✅ las tres, y ahora lo exige el test 4 **dentro de cada bloque** |
| Privilegios | ✅ y ahora con control: tres `is_definer` y tres casos `anon` esperando `42501` |
| Policies `using (true)` | ✅ ninguna |
| Códigos SQL ⊆ catálogo | ✅ los 14 distintos |
| Códigos por RPC vs contrato | ✅ los tres coinciden (descontando `INTERNAL_ERROR`, que lo produce el wrapper) |
| `plan(43)` vs aserciones | ✅ 43 y 43 |
| Claves de `platform_settings` | ✅ las dos existen en la migración y en `seed.sql` |
| Precedencia de errores RPC vs fake | ❌ ver `H10` |
| `RATE_LIMITED` alcanzable en el fake | ❌ ver `H11` |

**No ejecutado ni consultado:** `pnpm typecheck` · `lint` · `test` · `test:coverage` · `test:db` · los 8 jobs de CI.

## Archivos

- [`revisiones/ronda-1.md`](revisiones/ronda-1.md) · [`revisiones/ronda-2.md`](revisiones/ronda-2.md)
- [`hallazgos.jsonl`](hallazgos.jsonl) — 19 registros
- [`lecciones.md`](lecciones.md) — `AG-57` a `AG-59`
- [`evidencia/comandos.md`](evidencia/comandos.md) — barridos reproducibles
