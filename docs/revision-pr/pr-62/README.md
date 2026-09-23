# PR #62 — T-101 · `submit_offer`, `withdraw_offer`, `set_availability` y `rate_limits` atómico

> ❌ **Con bloqueantes · 2 bloqueantes · 7 mejoras · 4 decisiones resueltas**
> ⚠️ **Revisión estática**: a pedido de Lautaro073 no se corrieron suites ni se consultó CI.

| | |
|---|---|
| **PR** | [#62](https://github.com/cadeApp/cadeApp/pull/62) · `feat/T-101-rpc-offers-rate-limits` → `develop` |
| **Tarea / issue** | [`T-101`](../../tasks/T-101.md) · Issue #11 |
| **Autor** | Lautaro073 (agy) |
| **Revisión** | independiente — no es el agy que implementó |
| **SHA revisado** | `ee247ac` · base `origin/develop` = `ddef51a` |
| **Alcance** | 7 archivos · **0 fuera** de «Archivos permitidos» |

## Rondas

| Ronda | SHA | Fecha | Resultado | Informe |
|---|---|---|---|---|
| 1 | `ee247ac` | 2026-09-23 | ❌ 2 bloqueantes · 7 mejoras · 4 decisiones | [`ronda-1.md`](revisiones/ronda-1.md) |

## Resumen

La implementación SQL es sólida: las tres funciones son `security definer` con `set search_path = public,
pg_temp`, los privilegios se revocan y se regrantan explícitamente, el upsert de `rate_limits` es genuinamente
atómico sobre la PK `(subject, action, window_start)`, y el piso de oferta sale de `platform_settings` como manda
`AGENTS.md` §2. El cruce mecánico contra `rpc-contracts.ts` da **exacto** en `submit_offer` (12/12) y
`set_availability` (6/6).

Lo que falla está en los bordes: una clave de configuración que dos documentos dan por existente y no existe, y
un contrato que no deja distinguir un error del usuario de una caída de la base.

## Estado por hallazgo

### Bloqueantes

| id | archivo | qué |
|---|---|---|
| `H01` | `…rpc_offers_v1.sql:103` | El tope del rate limit es un literal `10` ×2; el cuerpo y la bitácora dicen que sale de `platform_settings.max_offers_per_min`, clave que **no existe** ni en el código ni en `seed.sql` |
| `H02` | `offers.ts:77` | Todo fallo de infraestructura se convierte en `VALIDATION_ERROR`, porque las tres RPC no declaran `INTERNAL_ERROR`. Y `withdraw_offer` declara `INVALID_STATE_TRANSITION` y nunca lo levanta |

### Mejoras

| id | archivo | qué |
|---|---|---|
| `H03` | `…rpc_offers_v1.sql:97` | El rate limit **no cuenta los intentos fallidos**: el `raise` revierte su propio incremento. Solo frena el tráfico válido |
| `H04` | `rpc_offers.sql:336` | El ítem «llamadas concurrentes» del DoD no está cubierto; el test que dice medir atomicidad afirma `count >= 1` |
| `H05` | `offers.test.ts:427` | El test «Contrato SQL» se satisface con una coincidencia de texto en un archivo de tres funciones, y compara los códigos en un solo sentido y con las tres listas juntas |
| `H06` | cuerpo del PR + bitácora | Cuatro contradicciones con el código, incluido un `DomainErrorCode` inventado (`REQUEST_NOT_PUBLISHED`) |
| `H07` | `log/T-101.md` | La bitácora registra una ampliación y un cambio en `public/brand/logo.svg` que no están en este PR ni en la ficha |
| `H08` | `rpc_offers.sql:114` | Nada comprueba que sigan siendo `security definer` ni que `anon` no pueda ejecutarlas |
| `H09` | `…rpc_offers_v1.sql:81` | El `for update` sobre `delivery_requests` se toma antes del upsert y de la lectura del piso, alargando la sección crítica |

### Decisiones

| id | qué | decisión |
|---|---|---|
| `D01` | El rate limit no cuenta fallidos | **aceptar y documentar** |
| `D02` | Tope hardcodeado en `10` | **hacerlo configurable** con `max_offers_per_min` en `platform_settings` + `seed.sql` |
| `D03` | Contratos de las tres RPC | **`contract-change`**: sacar `INVALID_STATE_TRANSITION`, agregar `INTERNAL_ERROR` |
| `D04` | «llamadas concurrentes» del DoD | **reformular el ítem** y que el test 32 afirme el valor exacto |

## Lo verificado (todo estático)

| | |
|---|---|
| Alcance | ✅ 7 archivos, 0 fuera |
| Construcciones prohibidas | ✅ 0 `any` · 0 `@ts-ignore` · 0 `!` · 0 `.only` · 0 `.skip` |
| `"use client"` en `src/server/` | ✅ ninguno |
| `security definer` + `search_path` | ✅ las tres |
| Privilegios | ✅ `revoke all from public, anon, authenticated` + `grant execute to authenticated` |
| Policies `using (true)` | ✅ ninguna |
| Códigos SQL ⊆ catálogo | ✅ los 14 distintos |
| Códigos por RPC vs contrato | ✅ `submit_offer` 12/12 · ✅ `set_availability` 6/6 · ❌ `withdraw_offer` +1 |
| `plan(32)` vs aserciones | ✅ 32 y 32, numeradas 1..32 sin huecos |
| Claves de `platform_settings` | ✅ `min_offer_ars` · ❌ `max_offers_per_min` no existe |

**No ejecutado ni consultado:** `pnpm typecheck` · `lint` · `test` · `test:coverage` · `test:db` · los 8 jobs de CI.

## Archivos

- [`revisiones/ronda-1.md`](revisiones/ronda-1.md) — informe completo
- [`hallazgos.jsonl`](hallazgos.jsonl) — 13 registros
- [`lecciones.md`](lecciones.md) — `AG-57` y `AG-58`
- [`evidencia/comandos.md`](evidencia/comandos.md) — barridos reproducibles
