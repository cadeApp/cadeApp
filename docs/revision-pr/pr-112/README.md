# PR #112 — T-123 · Admin de comercios y plataforma

> 🟢 **Ronda 2 — fase RED: SIN BLOQUEANTES PARA IMPLEMENTAR**

| | |
|---|---|
| PR | #112 |
| Rama | `feat/T-123-admin-comercios-plataforma` → `develop` |
| SHA funcional revisado | `ae130408eef848f91e31135c531fb5c5b0490215` |
| Base | `develop@7f392e9f0fc020f9dcf6838d1638cbbe4004d7ac` |
| Estado de la PR | Draft / fase RED completa |
| CI | typecheck ✅ · lint ✅ · build ✅ · audit ✅ · db-tests ✅ · bundle-budget ✅ · unit ❌ esperado por RED |
| Resultado | H01–H03 cerrados; puede comenzar implementación |

## Decisiones

- D01–D04: vigentes.
- **D05-B (Lautaro073):** excepción explícita a Regla 25 para T-123. Sin índices/pruebas RLS específicas en esta PR; deuda posterior.

## Estado de hallazgos

- **H01:** ✅ arreglado-verificado — payloads distintos para “Marcar mes pagado” y “Extender piloto”.
- **H02:** ✅ arreglado-verificado — cinco settings + switch piloto + “Últimos cambios” server-side.
- **H03:** ✅ arreglado-verificado — paginación conserva actor/action/entity.

## Importante

**SIN BLOQUEANTES PARA IMPLEMENTAR no significa lista para merge.**  
La PR sigue en Draft y con la implementación A03/A04/A06 pendiente.

Detalle: [revisiones/ronda-2.md](revisiones/ronda-2.md)
