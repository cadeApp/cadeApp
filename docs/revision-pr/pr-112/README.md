# PR #112 — T-123 · Admin de comercios y plataforma

> 🔴 **Ronda 3 — implementación GREEN: CON BLOQUEANTES (1)**

| | |
|---|---|
| PR | #112 |
| Rama | `feat/T-123-admin-comercios-plataforma` → `develop` |
| SHA funcional revisado | `da4c103c4e4ab874b0f64250f78c64800d9c07ad` |
| Base | `develop@7f392e9f0fc020f9dcf6838d1638cbbe4004d7ac` |
| Estado de la PR | Draft / implementación GREEN |
| CI | typecheck ✅ · lint ✅ · unit ✅ · build ✅ · audit ✅ · db-tests ✅ · bundle-budget ✅ |
| Unit | 73/73 archivos · 886/886 tests |
| Resultado | H04 bloquea cierre; H01–H03 siguen cerrados |

## Decisiones

- D01–D04: vigentes.
- **D05-B (Lautaro073):** excepción explícita a Regla 25 para T-123. Sin índices/pruebas RLS específicas en esta PR; deuda posterior.
- **D06-A (Lautaro073):** A06 mantiene `tipo de entidad + ID corto`; no se agregan lookups de nombres de comercio/repartidor.
- **D07-A (Lautaro073):** las 6 capturas de A03/A04/A06 a 1280 px y 1024 px, junto con la comprobación visual de foco/contraste, se difieren a T-300/staging con sesión admin AAL2 real. En T-123 quedan aceptadas/diferidas, **no verificadas**.

## Estado de hallazgos

- **H01:** ✅ arreglado-verificado — payloads distintos para “Marcar mes pagado” y “Extender piloto”.
- **H02:** ✅ arreglado-verificado — cinco settings + switch piloto + “Últimos cambios” server-side.
- **H03:** ✅ arreglado-verificado — paginación conserva actor/action/entity.
- **H04:** 🔴 abierto — A03 no prueba Escape + devolución de foco al botón “Editar plan”.

## Importante

La implementación y el CI del SHA revisado están verdes, pero la PR **NO está lista para merge** hasta cerrar H04 con un control que falle ante una regresión real de devolución de foco.

Las capturas de D07-A no bloquean T-123 porque quedaron explícitamente diferidas a T-300; no deben marcarse como verificadas aquí.

Detalle: [revisiones/ronda-3.md](revisiones/ronda-3.md)
