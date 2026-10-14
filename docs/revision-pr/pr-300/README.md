# PR #300 — T-349 · ficha de control de regresión del aislamiento CC-007

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/300 |
| Autor | Lautaro073 |
| Rama | `docs/T-348-ficha` → `develop` (el nombre de rama histórico no determina la tarea) |
| Base | `cd023e3453ead76983d54982df1548cb97aa57eb` |
| HEAD funcional revisado | `783640ab7db0550cd6efe9a9ece0d54734644136` |
| Tarea | T-349 (ficha nueva, relacionada con #243) |
| Revisión | **Ronda 1 — SIN BLOQUEANTES** |

Esta PR **solo define la ficha**; no implementa el control todavía.

## Ronda 1

- Informe completo: [`revisiones/ronda-1.md`](revisiones/ronda-1.md).
- `PR300-A01`: Lautaro073 eligió **1-A**, ratificar la tarea pequeña limitada al control de regresión (estado: **aceptado**).
- `PR300-A02`: Lautaro073 eligió **2-A**, ratificar la renumeración `T-348 → T-349` (estado: **aceptado**).
- No se identificaron bloqueantes técnicos ni decisiones pendientes.
- Body: se corrige frase obsoleta sobre fallo de `verify-fichas` de T-348; el CI real del HEAD tiene `verify-fichas 7/7` GREEN.

## Condición externa pendiente

`e2e-preview` del SHA revisado publicó estado **error** porque un job fue cancelado, no por una aserción RED del proyecto. Se solicitó rerun del job; no se debe afirmar GREEN ni mergear hasta que haya una validación exact-head exitosa y todos los checks aplicables estén correctos.

El `approval-policy` debía permanecer rojo antes de registrar el informe estructurado SIN BLOQUEANTES; su resultado posterior debe verificarse sobre el nuevo HEAD de revisión.

No hubo aprobación ni merge por parte de la revisión independiente.
