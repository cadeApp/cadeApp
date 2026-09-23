# PR #62 — T-101 · `submit_offer`, `withdraw_offer`, `set_availability` y `rate_limits` atómico

> ✅ **Lista para aceptar · 0 bloqueantes · 19 de 22 cerrados**
> ⚠️ **Revisión estática**: las tres rondas fueron sin correr suites ni consultar CI, a pedido de Lautaro073.

| | |
|---|---|
| **PR** | [#62](https://github.com/cadeApp/cadeApp/pull/62) · `feat/T-101-rpc-offers-rate-limits` → `develop` |
| **Tarea / issue** | [`T-101`](../../tasks/T-101.md) · Issue #11 |
| **Autor** | Lautaro073 (agy) |
| **Revisión** | independiente — no es el agy que implementó |
| **SHA revisado** | `35ce99d` · base `origin/develop` = `ddef51a` |
| **Alcance** | 19 archivos · **0 fuera** de «Archivos permitidos» |

## Rondas

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 1 | `ee247ac` | ❌ 2 bloqueantes · 7 mejoras · 4 decisiones | [`ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `15e9b72` | ❌ 1 bloqueante · 3 mejoras · 2 decisiones | [`ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `35ce99d` | ✅ **sin bloqueantes** · 3 bajos abiertos | [`ronda-3.md`](revisiones/ronda-3.md) |

## Resumen de las tres rondas

**La implementación SQL casi no se tocó.** `security definer` con `search_path` fijo, privilegios revocados y
regrantados explícitamente, upsert atómico sobre la PK `(subject, action, window_start)`, piso desde
`platform_settings`. Lo que cambió en tres rondas fue el contorno:

| | Ronda 1 | Ronda 3 |
|---|---|---|
| Tope del rate limit | literal `10` ×2, con dos documentos afirmando que salía de una clave inexistente | `platform_settings.max_offers_per_min`, sembrado y leído, con test que lo baja a 3 y lo comprueba |
| Fallo de infraestructura | `VALIDATION_ERROR` («revisá los datos ingresados») | `INTERNAL_ERROR`, vía `CC-001`, sin casts |
| Precedencia de errores | RPC y fake elegían distinto en 6 combinaciones | documentada una vez y **coincide en las tres piezas** |
| `RATE_LIMITED` en el fake | inalcanzable | contador por ventana equivalente al SQL |
| Control del contrato SQL | `toMatch` sobre el archivo entero | por función, bidireccional, con `INTERNAL_ERROR` excluido |
| Aserciones pgTAP | 32 | 43, con `is_definer` ×3 y `anon → 42501` ×3 |

**Tres rondas, tres demostraciones en rojo en commits propios** antes de cada arreglo de fondo: `f66b773`
(fase roja original), `b0e969b` (`H03`), `2d1e9fa` (`H10`).

## Lo que queda abierto

| id | sev | archivo | qué |
|---|---|---|---|
| `H14` | bajo | `rpc-fake.ts:541` | El handler repite el chequeo de repartidor que `executeRpc` ya hace: dos guardas inalcanzables en un archivo con umbral de 90 % de ramas |
| `H15` | bajo | `rpc-contracts.ts:327` | La precedencia se documentó solo para `submit_offer`; `withdraw_offer` y `set_availability` también la comparten y no está escrita |
| `H16` | bajo | `log/T-101.md` | La bitácora dice `note` donde el campo es `message` |

## Cerrados, con SHA

**19 de 22.** Los dos bloqueantes de la ronda 1, el de la ronda 2, y las seis decisiones `D01`–`D06`.

Cuatro arreglos quedaron mejores que lo pedido: el test 4 codifica una regla que mi propio barrido no tiene
(excluir `INTERNAL_ERROR` porque lo produce el wrapper); el test 5 agrega el avance de reloj que prueba que la
ventana se renueva; el fallback del wrapper también cubrió los `safeParse` de output; y el test 33 —que nadie
pidió— es el que prueba que el tope sale de verdad de `platform_settings`.

## Lo verificado (todo estático)

| | |
|---|---|
| Alcance | ✅ 19 archivos, 0 fuera; cada línea nueva de la ficha cita su decisión |
| Construcciones prohibidas | ✅ 0 `any` · 0 `@ts-ignore` · 0 `!` · 0 `.only` · 0 `.skip` |
| `security definer` + `search_path` por función | ✅ las tres, exigido dentro de cada bloque |
| Privilegios | ✅ con `is_definer` ×3 y `anon → 42501` ×3 |
| Códigos por RPC vs contrato | ✅ los tres, en los dos sentidos |
| **Precedencia SQL vs fake vs documentada** | ✅ **las tres coinciden** |
| `RATE_LIMITED` alcanzable en el fake | ✅ equivalente al SQL |
| `plan(43)` vs aserciones vs numeración | ✅ 43 · 43 · `1..43` sin duplicados |
| `platform_settings` usadas vs sembradas | ✅ las dos claves |

**No ejecutado ni consultado en ninguna ronda:** `pnpm typecheck` · `lint` · `test` · `test:coverage` ·
`test:db` · los 8 jobs de CI.

## Archivos

- [`revisiones/ronda-1.md`](revisiones/ronda-1.md) · [`ronda-2.md`](revisiones/ronda-2.md) · [`ronda-3.md`](revisiones/ronda-3.md)
- [`hallazgos.jsonl`](hallazgos.jsonl) — 22 registros
- [`lecciones.md`](lecciones.md) — `AG-57` a `AG-59`
- [`evidencia/comandos.md`](evidencia/comandos.md) — barridos reproducibles
