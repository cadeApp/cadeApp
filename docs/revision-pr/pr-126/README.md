# Revisión PR #126 — CC-013

- **PR:** #126 — `[CC-013] db:types independiente de la plantilla del generador`
- **Rama:** `cc/CC-013-db-types-remote`
- **Base:** `develop@b659027f49a96762d020e23f159f898b2895d938`
- **HEAD revisado:** `acccd45b4b6d3ec5d3c84e2c6d6165ddd5e52186`
- **Ronda vigente:** 1
- **Resultado:** **CON BLOQUEANTES (1)**
- **PR:** abierta, mergeable, 0 behind.
- **CI final:** no se usa como criterio de cierre mientras H01 siga abierto.

## Decisión P1

Lautaro073 aprobó **CC-013 como P1**, condicionado a corregir los bloqueantes de revisión.

Debe reflejarse en `docs/contracts/CC-013.md` marcando:

`- [x] P1 (dueño de esquema/RPC)`

No implica que la PR esté aprobada para merge.

## Validación independiente del contrato

Se verificó con los blobs reales preservados en la historia de esta misma rama:

- local/base: `51a224df8ffe7ad8a42336aaf4e390cf0e2d36a0` — 31.822 bytes;
- remoto/staging reconstruido: `caa03af8699d85eb9660aa8e178b94e72c98afa5` — 32.039 bytes.

Aplicando la función actual `normalizeGeneratedTypes` al blob remoto:

- elimina exactamente 1 bloque `__InternalSupabase`;
- normaliza exactamente 5 helpers;
- resultado final: **igualdad byte a byte** con el blob local;
- una columna de esquema mutada sigue visible y mantiene el diff.

El run real `migrate` 36535421202 confirma que el fallo de staging era exactamente ese bloque más los cinco helpers.

## Hallazgo vigente

- **PR126-H01 — BLOQUEANTE:** `tools/db-types.test.ts` solo ejercita `Enums`; se puede romper la normalización de `Tables`, `TablesInsert`, `TablesUpdate` y `CompositeTypes` manteniendo los cuatro tests nuevos en verde.

Detalle: `revisiones/ronda-1.md`. Evidencia: `evidencia/comandos.md`.
