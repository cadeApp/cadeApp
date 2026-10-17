# PR #384 — T-357 · Actualización del vehículo del repartidor

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/384 |
| Autor | @asako669 (P2) |
| Rama | `feat/T-357-actualizar-vehiculo-perfil` → `develop` |
| Base de referencia | `af0cf1d72e9e33524cde5db138d940fee33ce6f6`; merge-base `81e5ca607bc766f8a3a5f0e2b7b3f891e517448a` |
| SHA del código revisado más reciente | `523b49896b495e5faea4e6ef7fae577e249cf874` (R4) |
| Alcance | 12 archivos (código, pruebas, bitácora y autorrevisión), dentro de la ficha |
| Estado | **NO MERGEAR**: E2E integrado de viaje aún sin PASS; E2E antiguo FAIL por locator, corregido en 523b4989 pero nueva ejecución CANCELLED. H04 abierto; R01 corregido sin verificar. |

## Rondas independientes

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 1 | `d7347c9` | 5 bloqueantes, 0 decisiones pendientes | [revisiones/ronda-1.md](revisiones/ronda-1.md) |
| 2 | `fddaca33` | 4 arreglados sin verificar; H04 sigue abierto; merge con develop resuelto | [revisiones/ronda-2.md](revisiones/ronda-2.md) |
| 3 | `e8735396` | CI completa + E2E 85/85 PASS; H04 residual abierto por vista de viaje y actor ajeno | [revisiones/ronda-3.md](revisiones/ronda-3.md) |
| 4 | `523b4989` | R01 locator corregido sin GREEN; E2E del HEAD cancelado, H04 abierto | [revisiones/ronda-4.md](revisiones/ronda-4.md) |

## Hallazgos

| ID | Severidad | Estado | Tema |
|---|---|---|---|
| PR384-H01 | alto | arreglado sin verificar | La edición permite saltar la finalización del onboarding |
| PR384-H02 | alto | arreglado sin verificar | Inserción de documentos en edición sin respetar el flujo CC-025 |
| PR384-H03 | medio | arreglado sin verificar | La acción puede devolver éxito sin una fila actualizada |
| PR384-H04 | alto | abierto | Cobertura E2E y evidencia afirmadas sin demostración |
| PR384-H05 | medio | arreglado sin verificar | Error de lectura se convierte silenciosamente en onboarding |
| PR384-R01 | alto | arreglado sin verificar | Locator E2E de vista de viaje no unívoco (corregido; revalidación pendiente) |

## Decisiones del dueño (2026-10-16)

- **1-A:** cambiar el tipo o la patente **no modifica** `couriers.status` ni revoca la aprobación; licencia y seguro **opcionales** conforme D9.
- **2-A:** el formulario de edición toca **solo vehículo/patente**; licencia/seguro se administran por el circuito separado T-356/CC-025. No inventar exigencias por tipo de vehículo.

## Situación tras resolver conflictos

- `96dcc44b` mergeó `develop` (`cc7fb54b`) a la rama de T-357 sin rebase, con reconciliación de cinco archivos y preservación del flujo RPC de CC-025; GitHub marca mergeable=true y rama 0 commits detrás de develop.
- `828b7ab1` y `fddaca33` incorporaron guardas, separación documental y pruebas. Aún no se acredita GREEN/RED runtime de mutaciones independientes.
- Unit: 136/136 archivos, 2494/2494 tests PASS en GitHub Actions run `38984427873`. Typecheck/lint/build/audit/bundle PASS. DB/E2E Preview pendientes al redactar R2.
- `docs/tasks/log/T-357.md` y descripción de PR todavía describen el flujo documental antiguo y declaran completado un DoD no acreditado; deben corregirse antes de merge.

## Entregables y proceso

- [Ronda 1](revisiones/ronda-1.md), [ronda 2](revisiones/ronda-2.md) y [ronda 3](revisiones/ronda-3.md) y [ronda 4](revisiones/ronda-4.md).
- [Hallazgos estructurados](hallazgos.jsonl).
- [Evidencia, comandos y harness independiente de ronda 1](evidencia/comandos.md) y [evidencia ronda 2](evidencia/ronda-2.md) y [evidencia ronda 3](evidencia/ronda-3.md) y [evidencia ronda 4](evidencia/ronda-4.md).
- [Lecciones](lecciones.md).
- [Autorrevisión del autor conservada](autorrevision-agy-r1.md): el autor escribió el archivo `revisiones/ronda-1.md` previamente, contraviniendo AG-36; su texto se guardó intacto debajo de la nota de procedencia y **no** cuenta como revisión independiente.

Solo la revisión independiente actualiza esta carpeta. El autor debe escribir sus comprobaciones en `docs/tasks/log/T-357.md` y no marcar hallazgos como verificados. Después de cada arreglo se requiere otra ronda y pruebas RED→GREEN independientes antes de recomendar merge.

## R4 — estado actual

- CI para `25a0a5ea`: **136/136 archivos, 2528/2528 unit, DB PgTAP 26/2341, typecheck/lint/build/audit/bundle PASS**. 
- E2E para `25a0a5ea`: **82 Chromium PASS / 1 FAIL** por locator ambiguo en :1134 (tres intentos). Autor corrigió el locator en `523b4989` sin debilitar expectativa.
- E2E para `523b4989`: run `39014666112` **CANCELLED** y status `e2e-preview:error`. No hay evidencia de E2E PASS para ese HEAD.
- `develop` avanzó (~48 commits detrás al comparar con `523b4989`); GitHub indica `mergeable=true`, pero no revalidó integración E2E del código combinado. Resolver vía merge normal y verificar, nunca rebase.
