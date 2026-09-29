# Revisión PR #126 — CC-013

- **PR:** #126 — `[CC-013] db:types independiente de la plantilla del generador`
- **Rama:** `cc/CC-013-db-types-remote`
- **Base:** `develop@b659027f49a96762d020e23f159f898b2895d938`
- **HEAD funcional revisado:** `80155e4fea27e6a906fcbd59da73b266683ff832`
- **Ronda vigente:** 2
- **Resultado:** **SIN BLOQUEANTES DE CÓDIGO · EXCEPCIÓN DE GATE ACEPTADA POR P1**
- **PR:** abierta, no Draft, 0 behind, mergeable=true, mergeable_state=unstable.
- **CI técnico #601:** verde.
- **approval-policy #752/#753:** rojo por no aceptar identificadores `CC-xxx`; Lautaro073 eligió explícitamente **B: aceptar ese rojo para esta PR y seguir igual**.

## Estado

- `PR126-H01` — **arreglado-verificado** en `80155e4...`.
- `PR126-D01` — **aceptado**: P1 aprobó CC-013 y la casilla quedó marcada.
- `PR126-D02` — **aceptado**: excepción explícita al gate `approval-policy` para esta PR; no se falsea el informe usando `T-013`.

## Verificación H01

El fixture ahora contiene los cinco helpers:

- `Tables`
- `TablesInsert`
- `TablesUpdate`
- `Enums`
- `CompositeTypes`

La mutación independiente que normaliza solo `EnumName` deja cuatro helpers rotos y ahora hace fallar la primera prueba, por lo que el falso verde de Ronda 1 quedó cerrado.

## CI técnico

CI #601 sobre `80155e4...`:

- build ✅
- unit ✅
- db-tests ✅
- lint ✅
- audit ✅
- typecheck ✅
- bundle-budget ✅

## Gate residual

`.github/workflows/approval-policy.mjs` exige literalmente:

`Informe revisar-pr — T-\d{3}`

Por eso un informe honesto `CC-013` nunca satisface el gate actual. P1 decidió no corregir ese workflow en esta PR y aceptar el rojo como excepción conocida.

No se falsifica el identificador del informe para engañar el check.

Detalle: `revisiones/ronda-2.md`.
