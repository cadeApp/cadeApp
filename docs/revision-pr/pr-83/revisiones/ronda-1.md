# PR #83 · T-115 — Ronda 1

- **SHA revisado:** `4b4f18b0676cd5c5afb8ab5bb7f4328e28050621`
- **Base:** `develop@720e2d4f39ab5b4d5d09a55016072eb8fe940855`
- **Fecha:** 2026-09-24
- **Resultado:** **CON BLOQUEANTES (5)** · 1 mejora · 1 decisión resuelta.

> Revisión estática + mutaciones aisladas. CI no se miró porque hay bloqueantes. El checkout completo no pudo obtenerse por fallo DNS al resolver `github.com`; los blobs revisados son los del SHA exacto.

## Resumen

| ID | Sev. | Ubicación | Problema | Tipo |
|---|---:|---|---|---|
| H01 | alto | `actions.test.ts:92` | 6/6 happy paths pueden llamar a la RPC equivocada y seguir verdes | BLOQUEANTE |
| H02 | alto | `actions.test.ts:58` | auth/rol cubre 4/12 celdas | BLOQUEANTE |
| H03 | alto | `actions.test.ts:180` | no-show no prueba default ni `false → cancelled` | BLOQUEANTE |
| H04 | alto | `whatsapp.test.ts:56` | blacklist de PII no demuestra allowlist | BLOQUEANTE |
| H05 | medio | `log/T-115.md:13` | se certificó mutación con una falla de importación | BLOQUEANTE |
| H06 | bajo | `log/T-115.md:14` | bitácora contradictoria | MEJORA |
| D01 | decisión | `AGENTS.md:24` | teléfono en `wa.me` con actor autorizado | ACEPTADA |

## H01 · Las actions no prueban qué RPC ni qué input invocan · BLOQUEANTE

Barrí las seis actions. Los happy paths solo miran `res.ok` / `res.data.status`; ninguno afirma `callRequestRpc` con el nombre y el input esperados.

| Action | RPC esperada |
|---|---|
| `markTripPickedUpAction` | `mark_picked_up` |
| `markTripDeliveredAction` | `mark_delivered` |
| `courierCancelTripAction` | `courier_cancel_match` |
| `merchantReportNoShowAction` | `report_no_show` |
| `merchantCancelTripAction` | `cancel_request` |
| `republishTripAction` | `republish_request` |

**Rojo demostrado:** muté un modelo para que las seis llamen siempre a `mark_picked_up`; las seis aserciones felices actuales siguieron verdes porque el mock devolvió el objeto configurado por cada test.

**Arreglo:** en cada happy path afirmar RPC exacta, input exacto y una sola llamada, además del resultado.

Patrón: `P08-control-no-cubre-lo-que-dice`.

## H02 · Matriz de sesión/rol incompleta · BLOQUEANTE

La PR declara verificación estricta de sesión y rol por Server Action. Enumerada la clase completa:

| Action | sin sesión | rol incorrecto |
|---|---:|---:|
| picked up | ✅ | ✅ |
| delivered | ❌ | ✅ |
| courier cancel | ❌ | ❌ |
| no show | ❌ | ✅ |
| merchant cancel | ❌ | ❌ |
| republish | ❌ | ❌ |

Solo 4/12 celdas están cubiertas.

**Rojo demostrado:** quité el guard de rol en courier cancel, merchant cancel y republish; sus happy paths actuales siguieron verdes. Los casos de rol incorrecto propuestos caen en rojo.

**Arreglo:** matriz `action × {UNAUTHENTICATED, UNAUTHORIZED_ACTOR}` (por ejemplo con `it.each`) para las seis actions.

Patrón: `P08-control-no-cubre-lo-que-dice`.

## H03 · `report_no_show` solo prueba `republish:true` · BLOQUEANTE

El test se llama “con republish por defecto”, pero pasa `republish: true` explícitamente. La clase completa es:

1. omitido → default true → `published`;
2. true → `published`;
3. false → `cancelled`.

La bitácora dice “con/sin republicar” y el cuerpo de la PR dice `published/cancelled`, pero hoy solo existe #2.

**Rojo demostrado:** una mutación que fuerza `republish=true` siempre mantiene verde el caso actual; el nuevo caso `false → cancelled` cae en rojo. El default tampoco puede verificarse mientras nunca se omita el campo.

Patrón: `P06-enumeracion-incompleta`.

## H04 · “Sin datos de más” usa blacklist · BLOQUEANTE

Enumeré las dos builders. Los tests prohíben tokens como `dni`, `cuit`, `uuid`, `patente` y formas de teléfono, pero el contrato pide que **solo** salgan los datos permitidos.

**Rojo demostrado:** agregué `Dirección exacta: San Martín 450` al mensaje comercio↔repartidor y al de “Avisar a mi cliente”. Todas las aserciones actuales siguieron verdes.

**Arreglo:** usar sentinelas/allowlist: pasar deliberadamente un objeto más ancho en runtime con teléfono, direcciones, coordenadas, notas, patente, etc. como `SENTINEL_*` y afirmar que ningún sentinel sale; conservar además las aserciones positivas de los campos permitidos.

Patrón: `P08-control-no-cubre-lo-que-dice`.

## H05 · La evidencia roja no rompe la propiedad · BLOQUEANTE

La bitácora evidencia:

- `Failed to resolve import "./actions"`
- `Failed to resolve import "@/lib/whatsapp"`

El cuerpo marca `[x] Cada prueba nueva se demostró fallando al romper la regla`. Con module resolution fallando ninguna aserción se ejecuta.

El rojo inicial es válido para arrancar TDD; lo incorrecto es certificarlo como la demostración fuerte del principio 8.

**Arreglo:** desmarcar esa evidencia por ahora y, antes de cerrar T-115, registrar mutación concreta → rojo → restauración de memoria → verde. H01–H04 ya dan cuatro mutaciones mínimas.

Patrón: `P08-control-no-cubre-lo-que-dice`.

## H06 · Bitácora contradictoria · MEJORA

La línea 7 dice que la PR #83 ya se abrió en Draft; la línea 14 todavía dice que falta abrirla. También conserva `Último commit: 37b656d` mientras el head revisado es `4b4f18b`.

Corregir en el próximo cierre de sesión.

Patrón: `P03-comentario-contradice-codigo`.

## D01 · Teléfono en `wa.me` · ACEPTADA

Antes de redactar el informe pregunté el único 🔵 pendiente.

**Decisión de Lautaro073 (2026-09-24):** la prohibición absoluta de `AGENTS.md §2` está mal para este caso. Si comercio o cadete aceptado ya puede leer el teléfono por RLS, T-115 puede usarlo como destinatario de `wa.me`.

- No bloquea T-115.
- No se toca `AGENTS.md` dentro de T-115: queda fuera de alcance.
- Queda residual corregir la regla global en un cambio separado.

## NO TOCAR

- El Draft rojo por módulos aún inexistentes no es por sí mismo un defecto.
- `src/lib/whatsapp.ts` está permitido por la ficha y pertenece a la zona P2.
- `test:db` es n.a. para este diff.
- D01 autoriza el teléfono en `wa.me` para actores ya autorizados por RLS.

## Checks

Alcance ✅ · head remoto ✅ · comentarios/threads: 0 · `test:db` n.a. · CI no consultado. `typecheck/lint/test` no ejecutados independientemente por fallo DNS del entorno al intentar clonar.
