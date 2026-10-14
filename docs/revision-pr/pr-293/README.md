# PR #293 — T-347 · ficha de mutaciones RED E2E en runner trusted

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/293 |
| **Tarea** | T-347 · ficha nueva |
| **Autor** | @Lautaro073 |
| **Rama** | `docs/T-347-ficha` → `develop` |
| **Base** | `64dfdf653219c6cf08a223c0df829353d9d9d8f1` |
| **HEAD funcional revisado** | `92a9f5ee3d5f16b3f4304cfbefb0e0ff5ba80952` |
| **Estado** | **SIN BLOQUEANTES — ronda 2** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `dfb5fb1cf9db5013a322c11129b97b063a6ded8b` | CON BLOQUEANTE | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `92a9f5ee3d5f16b3f4304cfbefb0e0ff5ba80952` | **SIN BLOQUEANTES** | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado de hallazgos

- `PR293-H01` ✅ arreglado-verificado en Ronda 2.
- `PR293-A01..A04` ✅ decisiones aceptadas de Lautaro073.

No quedan decisiones 🔵, bloqueantes ni mejoras pendientes en la ficha.

## Qué queda después del merge

Esta PR solo incorpora la ficha y documentación de T-347. **No implementa el workflow.**

Por eso:

1. #289 permanece abierto.
2. Después del merge se toma T-347 para implementar `e2e-mutation` con el contrato aprobado.
3. La validación punta a punta ocurre después de mergear la implementación a `develop`, según decisión 3-A.
4. Si una mutación no termina `RED_CONFIRMED`, #289 permanece/reabre y no se adulteran specs ni `expectedFailure`.

La revisión independiente no aprueba ni mergea la PR.
