# PR #64 — T-102 · `accept_offer` atómica e idempotente

> ❌ **Ronda 1 · 3 bloqueantes · 3 mejoras · 2 decisiones (ya resueltas)**
> Revisión estática: por el método acordado, CI se mira recién cuando la ronda está para aprobar.

| | |
|---|---|
| **PR** | [#64](https://github.com/cadeApp/cadeApp/pull/64) · `feat/T-102-rpc-accept-offer` → `develop` |
| **Tarea / issue** | [`T-102`](../../tasks/T-102.md) · Issue #12 |
| **Autor** | Lautaro073 (agy) |
| **Revisión** | independiente — no es el agy que implementó |
| **SHA revisado** | `071ba95` · base `origin/develop` = `4ec86e2` (ya trae T-101) |
| **Alcance** | 10 archivos · **0 fuera** de «Archivos permitidos» |

## Rondas

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 1 | `071ba95` | ❌ 3 bloqueantes · 3 mejoras · 2 decisiones | [`ronda-1.md`](revisiones/ronda-1.md) |

## En una frase

**Nada en la PR detectaría que se pierda el `FOR UPDATE` sobre `delivery_requests`** — el lock que serializa los
accept concurrentes, que es el invariante que el DoD pone primero. Tres piezas dicen cubrirlo y ninguna lo hace.

## Bloqueantes

| id | sev | archivo | qué |
|---|---|---|---|
| `H01` | alto | `offers.test.ts:992` | Las aserciones de locks usan `[\s\S]*?`, que cruza sentencias: quitar el `for update` de `delivery_requests` **o** el de `offers` deja las tres en verde. Demostrado con tres mutaciones |
| `H02` | alto | `rpc_accept.sql:313` | El ítem del DoD «10 llamadas concurrentes» está tildado y las dos pruebas son secuenciales: `for i in 1..10` en una sesión, y `Promise.all` sobre un fake síncrono |
| `H03` | alto | migración `:130` | El vencimiento perezoso hace `update … 'expired'` y el `raise` inmediato lo revierte. `CC-003`, el comentario y el cuerpo afirman los tres que la transición ocurre |

## Mejoras

| id | sev | archivo | qué |
|---|---|---|---|
| `H04` | medio | `CC-003.md:1` | Se titula `# CC-002`, que ya existe en develop con otro contenido; `offers.ts:48` propaga la cita |
| `H05` | bajo | `offers.ts:75` | La rama `23505 → ALREADY_MATCHED` es inalcanzable: el SQL ya convierte `unique_violation` |
| `H06` | bajo | `T-102.md:11` | La expansión de «idem que T-101» es fiel pero perdió las justificaciones por línea |

## Decisiones — preguntadas y resueltas antes de escribir el informe

| id | qué se decidió |
|---|---|
| `D01` | **Reformular el ítem del DoD** como la `D04` de T-101, y endurecer la aserción estática para que detecte la pérdida de cada lock por separado y verifique el orden de adquisición |
| `D02` | **Sacar el `update`** y alinear con `submit_offer`; corregir el paso 6 de `CC-003`, el comentario de la migración y el cuerpo de la PR |

## Lo que está bien

El diseño. La serialización por lock de fila con re-lectura bajo READ COMMITTED, la idempotencia preservando
`matchedAt`, el rechazo en cascada de las ofertas hermanas y los privilegios están bien resueltos. Verificado
además: precedencia de 8 pasos coincidente en las tres piezas, códigos en los dos sentidos, `plan(34)` = 34
aserciones, los 20 `throws_ok` en la forma correcta de 4 argumentos (la trampa `AG-35` de la #56, evitada), y las
7 policies de `offers` enumeradas.

**El cierre de `PR56-H21` quedó mejor que lo que pedía la ficha:** en vez de borrar `offers_update_merchant` se la
recreó con `with check (false)`, que es estrictamente más restrictivo y da `42501` explícito donde borrarla daría
un no-op silencioso.

**`CC-003` aplica preventivamente las decisiones de T-101** (`D03`, `D05`, `H10`, `H15`) sin que nadie lo pidiera,
y el test 8 ya usa el control por bloque de función que salió de la #62 (`AG-58`).

## Archivos

- [`revisiones/ronda-1.md`](revisiones/ronda-1.md)
- [`hallazgos.jsonl`](hallazgos.jsonl) — 8 registros
- [`lecciones.md`](lecciones.md) — `AG-61`
- [`evidencia/comandos.md`](evidencia/comandos.md) — barridos y mutaciones reproducibles
