# PR #64 — T-102 · `accept_offer` atómica e idempotente

> ✅ **Lista para aceptar · 0 bloqueantes · 8 de 8 cerrados, ninguno abierto**
> Ronda 1 estática; ronda 2 con CI leído por dentro, según el método: CI se mira recién cuando la ronda cierra
> sin bloqueantes.

| | |
|---|---|
| **PR** | [#64](https://github.com/cadeApp/cadeApp/pull/64) · `feat/T-102-rpc-accept-offer` → `develop` |
| **Tarea / issue** | [`T-102`](../../tasks/T-102.md) · Issue #12 |
| **Autor** | Lautaro073 (agy) |
| **Revisión** | independiente — no es el agy que implementó |
| **SHA final** | `570473d` · base `origin/develop` = `4ec86e2` al abrir la revisión |
| **Alcance** | 10 archivos en la ronda 1 · 9 en la ronda 2 · **0 fuera** de «Archivos permitidos» |

## Rondas

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 1 | `071ba95` | ❌ 3 bloqueantes · 3 mejoras · 2 decisiones | [`ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `570473d` | ✅ **sin bloqueantes · 8/8 cerrados** | [`ronda-2.md`](revisiones/ronda-2.md) |

## Qué cambió en dos rondas

El diseño no se tocó, y no hacía falta: serialización por lock de fila con re-lectura bajo READ COMMITTED,
idempotencia preservando `matchedAt`, cascada de ofertas hermanas en la misma transacción, privilegios
endurecidos. Lo que cambió fue que los controles pasaran a medir lo que dicen medir.

| | Ronda 1 | Ronda 2 |
|---|---|---|
| Aserciones de locks | `[\s\S]*?` cruzaba sentencias: quitar **cualquiera** de los dos `FOR UPDATE` dejaba las tres en verde | ancladas con `[^;]*?`, con orden por índice **y la mutación encodeada en el test** |
| Ítem de concurrencia del DoD | tildado, con dos pruebas secuenciales como evidencia | reformulado en la ficha y en el plan, nombrando el mecanismo que sí está verificado |
| Vencimiento perezoso | `update … 'expired'` que el `raise` revertía, afirmado en tres documentos | eliminado, explicado, y con control negativo permanente |
| `CC-003` | se titulaba `# CC-002`, que ya existe en develop | corregido, más las cuatro citas en código y tests |

### La mutación quedó escrita en el test, que es más de lo que pedí

El arreglo de `H01` no solo ancló los regex: dejó `M1` y `M2` como aserción permanente dentro del test. Lo mutué
para ver si era adorno y no lo es — **si alguien afloja los regex al comodín viejo, esas aserciones se ponen
rojas**. El control detecta su propia degradación. Es `AG-63`.

| | ronda 1 | ronda 2 |
|---|---|---|
| sin el `for update` de `offers` | verde | **rojo** |
| sin el de `delivery_requests` | verde | **rojo** |
| orden de locks invertido | verde | **rojo** |
| regex aflojado al comodín viejo | — | **rojo** |
| `update … 'expired'` de vuelta | verde | **rojo** |

## Lo que queda abierto

**Nada.** Los 8 registros cerrados, todos con `verificado_en_sha`.

Una opcional que no es hallazgo: al test 13 de pgTAP se le podría sumar el gemelo en runtime del control estático
nuevo — afirmar que tras `REQUEST_EXPIRED` la solicitud sigue en `published`.

## Lo mejor de la PR

- **El cierre de `PR56-H21` quedó mejor que lo que pedía la ficha:** en vez de borrar `offers_update_merchant` se
  la recreó con el mismo `using` y `with check (false)` — estrictamente más restrictivo, y con `42501` explícito
  donde borrarla daría un no-op silencioso.
- **`CC-003` aplicó preventivamente las decisiones de T-101** (`D03`, `D05`, `H10`, `H15`) sin que nadie lo pidiera.
- **El test 8 ya usaba `AG-58`** de la #62 —separar por bloque de función— antes de que lo pidiera acá.
- **El comentario de `H03` nombra dónde vive de verdad el comportamiento** (el cron de barrido de T-104), que es
  lo que evita que alguien vuelva a agregar el `update`. Verifiqué que T-104 existe y es eso.
- Cuatro fases rojas en commit propio a lo largo de la tarea (`4bc43f8` entre ellas).

## Lo verificado

| | |
|---|---|
| Alcance | ✅ 0 archivos fuera; cada línea de la ficha cita su autorización |
| Construcciones prohibidas | ✅ 0 `any` · 0 `@ts-ignore` · 0 `!` · 0 `.only` · 0 `.skip` |
| `security definer` + `search_path` + privilegios | ✅ |
| Códigos SQL vs contrato | ✅ los dos sentidos; solo sobra `INTERNAL_ERROR` |
| Precedencia de 8 pasos | ✅ coincide en las tres piezas |
| pgTAP | ✅ `plan(34)` · 34 aserciones · `1..34` · los 20 `throws_ok` en la forma de 4 argumentos (`AG-35`) |
| Policies sobre `offers` | ✅ las 7 enumeradas; ninguna otra deja escribir al comercio |
| CI sobre `570473d` | ✅ 8/8 leídos por dentro: `206 passed` · `Files=5, Tests=175` · `Result: PASS` · cruce `2+55+34+43+41 = 175` |

## Archivos

- [`revisiones/ronda-1.md`](revisiones/ronda-1.md) · [`ronda-2.md`](revisiones/ronda-2.md)
- [`hallazgos.jsonl`](hallazgos.jsonl) — 8 registros, 8 cerrados
- [`lecciones.md`](lecciones.md) — `AG-61` a `AG-63`, más una advertencia para T-103
- [`evidencia/comandos.md`](evidencia/comandos.md) — barridos y mutaciones reproducibles
