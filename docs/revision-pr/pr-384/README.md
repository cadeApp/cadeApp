# PR #384 — T-357 · Actualización del vehículo del repartidor

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/384 |
| Autor | @asako669 (P2) |
| Rama | `feat/T-357-actualizar-vehiculo-perfil` → `develop` |
| Base de referencia | `af0cf1d72e9e33524cde5db138d940fee33ce6f6`; merge-base `81e5ca607bc766f8a3a5f0e2b7b3f891e517448a` |
| SHA del código revisado | `d7347c9f1e37d6c6c350389228f88a9aa6c25722` |
| Alcance | 12 archivos (código, pruebas, bitácora y autorrevisión), dentro de la ficha |
| Estado | **NO MERGEAR**: CI y E2E Preview verdes, pero H04 sigue con proyección en viaje y negativa directa sin probar; 4 hallazgos arreglados pendientes de mutaciones runtime independientes. |

## Rondas independientes

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 1 | `d7347c9` | 5 bloqueantes, 0 decisiones pendientes | [revisiones/ronda-1.md](revisiones/ronda-1.md) |
| 2 | `fddaca33` | 4 arreglados sin verificar; H04 sigue abierto; merge con develop resuelto | [revisiones/ronda-2.md](revisiones/ronda-2.md) |
| 3 | `e8735396` | CI completa + E2E 85/85 PASS; H04 residual abierto por vista de viaje y actor ajeno | [revisiones/ronda-3.md](revisiones/ronda-3.md) |

## Hallazgos

| ID | Severidad | Estado | Tema |
|---|---|---|---|
| PR384-H01 | alto | arreglado sin verificar | La edición permite saltar la finalización del onboarding |
| PR384-H02 | alto | arreglado sin verificar | Inserción de documentos en edición sin respetar el flujo CC-025 |
| PR384-H03 | medio | arreglado sin verificar | La acción puede devolver éxito sin una fila actualizada |
| PR384-H04 | alto | abierto | Cobertura E2E y evidencia afirmadas sin demostración |
| PR384-H05 | medio | arreglado sin verificar | Error de lectura se convierte silenciosamente en onboarding |

## Decisiones del dueño (2026-10-16)

- **1-A:** cambiar el tipo o la patente **no modifica** `couriers.status` ni revoca la aprobación; licencia y seguro **opcionales** conforme D9.
- **2-A:** el formulario de edición toca **solo vehículo/patente**; licencia/seguro se administran por el circuito separado T-356/CC-025. No inventar exigencias por tipo de vehículo.

## Situación tras resolver conflictos

- `96dcc44b` mergeó `develop` (`cc7fb54b`) a la rama de T-357 sin rebase, con reconciliación de cinco archivos y preservación del flujo RPC de CC-025; GitHub marca mergeable=true y rama 0 commits detrás de develop.
- `828b7ab1` y `fddaca33` incorporaron guardas, separación documental y pruebas. Aún no se acredita GREEN/RED runtime de mutaciones independientes.
- Unit: 136/136 archivos, 2494/2494 tests PASS en GitHub Actions run `38984427873`. Typecheck/lint/build/audit/bundle PASS. DB/E2E Preview pendientes al redactar R2.
- `docs/tasks/log/T-357.md` y descripción de PR todavía describen el flujo documental antiguo y declaran completado un DoD no acreditado; deben corregirse antes de merge.

## Entregables y proceso

- [Ronda 1](revisiones/ronda-1.md), [ronda 2](revisiones/ronda-2.md) y [ronda 3](revisiones/ronda-3.md).
- [Hallazgos estructurados](hallazgos.jsonl).
- [Evidencia, comandos y harness independiente de ronda 1](evidencia/comandos.md) y [evidencia ronda 2](evidencia/ronda-2.md) y [evidencia ronda 3](evidencia/ronda-3.md).
- [Lecciones](lecciones.md).
- [Autorrevisión del autor conservada](autorrevision-agy-r1.md): el autor escribió el archivo `revisiones/ronda-1.md` previamente, contraviniendo AG-36; su texto se guardó intacto debajo de la nota de procedencia y **no** cuenta como revisión independiente.

Solo la revisión independiente actualiza esta carpeta. El autor debe escribir sus comprobaciones en `docs/tasks/log/T-357.md` y no marcar hallazgos como verificados. Después de cada arreglo se requiere otra ronda y pruebas RED→GREEN independientes antes de recomendar merge.
