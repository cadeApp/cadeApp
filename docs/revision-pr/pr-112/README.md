# PR #112 — T-123 · Admin de comercios y plataforma

> 🟢 **Ronda 4 — SIN BLOQUEANTES**

| | |
|---|---|
| PR | #112 |
| Rama | `feat/T-123-admin-comercios-plataforma` → `develop` |
| SHA funcional revisado | `b1a48e908f83a604496bd1168bb1e152763c74b2` |
| Base | `develop@7f392e9f0fc020f9dcf6838d1638cbbe4004d7ac` |
| Estado de la PR | Draft |
| CI | typecheck ✅ · lint ✅ · unit ✅ · build ✅ · audit ✅ · db-tests ✅ · bundle-budget ✅ |
| Unit | 73/73 archivos · 887/887 tests |
| DB | 12/12 archivos · 1529 tests · PASS |
| Resultado | H01–H04 cerrados; sin bloqueantes de revisión |

## Decisiones

- D01–D04: vigentes.
- **D05-B (Lautaro073):** excepción explícita a Regla 25 para T-123. Sin índices/pruebas RLS específicas en esta PR; deuda posterior.
- **D06-A (Lautaro073):** A06 mantiene `tipo de entidad + ID corto`; no se agregan lookups de nombres de comercio/repartidor.
- **D07-A (Lautaro073):** las 6 capturas de A03/A04/A06 a 1280 px y 1024 px, junto con la comprobación visual de foco/contraste, se difieren a T-300/staging con sesión admin AAL2 real. En T-123 quedan aceptadas/diferidas, **no verificadas**.

## Estado de hallazgos

- **H01:** ✅ arreglado-verificado — payloads distintos para “Marcar mes pagado” y “Extender piloto”.
- **H02:** ✅ arreglado-verificado — cinco settings + switch piloto + “Últimos cambios” server-side.
- **H03:** ✅ arreglado-verificado — paginación conserva actor/action/entity.
- **H04:** ✅ arreglado-verificado — Escape cierra “Editar plan” y el foco vuelve al mismo botón disparador.

## Limitación de la Ronda 4

La revisión verificó el test nuevo por inspección sobre el SHA exacto y confirmó su GREEN en CI. El agy registró la mutación RED pedida en Ronda 3 (blur del disparador → 1 fallo / 6 verdes) y GREEN restaurado (7/7). El entorno del reviewer volvió a fallar al clonar por DNS (`Could not resolve host: github.com`), por lo que esa mutación no se declara como reejecutada localmente por la revisión.

Esto no cambia el estado de H04: el control faltante existe, ejerce la propiedad correcta y el SHA revisado pasa la suite completa.

## Estado de merge

**Sin bloqueantes de revisión.** La PR sigue Draft y no fue aprobada ni mergeada automáticamente. D07-A continúa como carry-over obligatorio para T-300/staging.

Detalle: [revisiones/ronda-4.md](revisiones/ronda-4.md)
