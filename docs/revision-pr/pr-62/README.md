# PR #62 — T-101 · `submit_offer`, `withdraw_offer`, `set_availability` y `rate_limits` atómico

> ✅ **Lista para aceptar · 0 bloqueantes · 22 de 22 cerrados, ninguno abierto**
> Las rondas 1 a 3 fueron estáticas, sin correr suites ni mirar CI, a pedido de Lautaro073. Desde la ronda 4 el
> método es: verificar el código primero y **mirar CI recién cuando la ronda ya está para aprobar**.

| | |
|---|---|
| **PR** | [#62](https://github.com/cadeApp/cadeApp/pull/62) · `feat/T-101-rpc-offers-rate-limits` → `develop` |
| **Tarea / issue** | [`T-101`](../../tasks/T-101.md) · Issue #11 |
| **Autor** | Lautaro073 (agy) |
| **Revisión** | independiente — no es el agy que implementó |
| **SHA final** | `3c9d94f` · base `origin/develop` = `ddef51a` |
| **Alcance** | 19 archivos en las rondas 1–3 · 4 en la ronda 4 · **0 fuera** de «Archivos permitidos» |

## Rondas

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 1 | `ee247ac` | ❌ 2 bloqueantes · 7 mejoras · 4 decisiones | [`ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `15e9b72` | ❌ 1 bloqueante · 3 mejoras · 2 decisiones | [`ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `35ce99d` | ✅ sin bloqueantes · 3 bajos abiertos | [`ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `3c9d94f` | ✅ **los 3 bajos cerrados · 22/22 · sin hallazgos nuevos** | [`ronda-4.md`](revisiones/ronda-4.md) |

## Resumen de las cuatro rondas

**La implementación SQL casi no se tocó.** `security definer` con `search_path` fijo, privilegios revocados y
regrantados explícitamente, upsert atómico sobre la PK `(subject, action, window_start)`, piso desde
`platform_settings`. Lo que cambió fue el contorno:

| | Ronda 1 | Ronda 4 |
|---|---|---|
| Tope del rate limit | literal `10` ×2, con dos documentos afirmando que salía de una clave inexistente | `platform_settings.max_offers_per_min`, sembrado y leído, con test que lo baja a 3 y lo comprueba |
| Fallo de infraestructura | `VALIDATION_ERROR` («revisá los datos ingresados») | `INTERNAL_ERROR`, vía `CC-001`, sin casts |
| Precedencia de errores | RPC y fake elegían distinto en 6 combinaciones | documentada para **las tres RPC** y coincide en las tres piezas |
| `RATE_LIMITED` en el fake | inalcanzable | contador por ventana equivalente al SQL |
| Control del contrato SQL | `toMatch` sobre el archivo entero | por función, bidireccional, con `INTERNAL_ERROR` excluido |
| Aserciones pgTAP | 32 | 43, con `is_definer` ×3 y `anon → 42501` ×3 |
| Ramas inalcanzables en `rpc-fake.ts` | — | eliminadas · cobertura de ramas `91.86 %` sobre umbral `90 %` |

**Tres rondas, tres demostraciones en rojo en commits propios** antes de cada arreglo de fondo: `f66b773`
(fase roja original), `b0e969b` (`H03`), `2d1e9fa` (`H10`).

## Lo que queda abierto

**Nada.** Los 22 hallazgos cerrados, todos con `verificado_en_sha`.

Dos apuntes cosméticos de la ronda 4 que no son hallazgos: el comentario de `set_availability` no señala que
ahí los parámetros van antes del repartidor (al revés que en `submit_offer`), y la línea `Aprobaciones` de
`CC-001` enumera las decisiones `D02`–`D06` pero no `H14`/`H15`, cuya autorización viene por la ficha.

## Lo mejor de la PR

Cuatro arreglos quedaron mejores que lo pedido: el test 4 codifica una regla que mi propio barrido no tiene
(excluir `INTERNAL_ERROR` porque lo produce el wrapper); el test 5 agrega el avance de reloj que prueba que la
ventana se renueva; el fallback del wrapper también cubrió los `safeParse` de output; y el test 33 —que nadie
pidió— es el que prueba que el tope sale de verdad de `platform_settings`.

## Lo verificado

| | |
|---|---|
| Alcance | ✅ 0 archivos fuera; cada línea nueva de la ficha cita su decisión |
| Construcciones prohibidas | ✅ 0 `any` · 0 `@ts-ignore` · 0 `!` · 0 `.only` · 0 `.skip` |
| `security definer` + `search_path` por función | ✅ las tres |
| Privilegios | ✅ con `is_definer` ×3 y `anon → 42501` ×3 |
| Códigos por RPC vs contrato | ✅ los tres, en los dos sentidos |
| Precedencia SQL vs fake vs documentada | ✅ **las tres RPC, las tres piezas** |
| `RATE_LIMITED` alcanzable en el fake | ✅ equivalente al SQL |
| `plan(43)` vs aserciones vs numeración | ✅ 43 · 43 · `1..43` sin duplicados |
| `platform_settings` usadas vs sembradas | ✅ las dos claves |
| CI sobre `3c9d94f` (ronda 4) | ✅ 8/8, leídos por dentro: `161 passed` · `Files=4, Tests=141` · `Result: PASS` |

## Archivos

- [`revisiones/ronda-1.md`](revisiones/ronda-1.md) · [`ronda-2.md`](revisiones/ronda-2.md) · [`ronda-3.md`](revisiones/ronda-3.md) · [`ronda-4.md`](revisiones/ronda-4.md)
- [`hallazgos.jsonl`](hallazgos.jsonl) — 22 registros, 22 cerrados
- [`lecciones.md`](lecciones.md) — `AG-57` a `AG-60`
- [`evidencia/comandos.md`](evidencia/comandos.md) — barridos reproducibles
