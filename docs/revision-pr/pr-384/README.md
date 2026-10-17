# PR #384 — T-357 · Actualización del vehículo del repartidor

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/384 |
| Autor | @asako669 (P2) |
| Rama | `feat/T-357-actualizar-vehiculo-perfil` → `develop` |
| Base de referencia | `af0cf1d72e9e33524cde5db138d940fee33ce6f6`; merge-base `81e5ca607bc766f8a3a5f0e2b7b3f891e517448a` |
| SHA del código revisado más reciente | `7b2dadba73800a8548433c1cc1051f2264243bff` (R5) |
| Alcance | 12 archivos (código, pruebas, bitácora y autorrevisión), dentro de la ficha |
| Estado | **CI y E2E integrados PASS**; H04 y R01 verificados por logs reales. Cuatro hallazgos previos corregidos sin mutaciones runtime independientes; no adjudicarles verificación no ejecutada. |

## Rondas independientes

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 1 | `d7347c9` | 5 bloqueantes, 0 decisiones pendientes | [revisiones/ronda-1.md](revisiones/ronda-1.md) |
| 2 | `fddaca33` | 4 arreglados sin verificar; H04 sigue abierto; merge con develop resuelto | [revisiones/ronda-2.md](revisiones/ronda-2.md) |
| 3 | `e8735396` | CI completa + E2E 85/85 PASS; H04 residual abierto por vista de viaje y actor ajeno | [revisiones/ronda-3.md](revisiones/ronda-3.md) |
| 4 | `523b4989` | R01 locator corregido sin GREEN; E2E del HEAD cancelado, H04 abierto | [revisiones/ronda-4.md](revisiones/ronda-4.md) |
| 5 | `7b2dadba` | Merge develop validado; CI y E2E 88/88 PASS; H04/R01 verificados; cuatro pendientes mutación independiente | [revisiones/ronda-5.md](revisiones/ronda-5.md) |

## Hallazgos

| ID | Severidad | Estado | Tema |
|---|---|---|---|
| PR384-H01 | alto | arreglado sin verificar | La edición permite saltar la finalización del onboarding |
| PR384-H02 | alto | arreglado sin verificar | Inserción de documentos en edición sin respetar el flujo CC-025 |
| PR384-H03 | medio | arreglado sin verificar | La acción puede devolver éxito sin una fila actualizada |
| PR384-H04 | alto | arreglado verificado (E2E) | Cobertura E2E y evidencia afirmadas sin demostración |
| PR384-H05 | medio | arreglado sin verificar | Error de lectura se convierte silenciosamente en onboarding |
| PR384-R01 | alto | arreglado verificado (E2E) | Locator E2E de vista de viaje no unívoco (RED→GREEN) |

## Decisiones del dueño (2026-10-16)

- **1-A:** cambiar el tipo o la patente **no modifica** `couriers.status` ni revoca la aprobación; licencia y seguro **opcionales** conforme D9.
- **2-A:** el formulario de edición toca **solo vehículo/patente**; licencia/seguro se administran por el circuito separado T-356/CC-025. No inventar exigencias por tipo de vehículo.

## Situación tras resolver conflictos

- `96dcc44b` mergeó `develop` (`cc7fb54b`) a la rama de T-357 sin rebase, con reconciliación de cinco archivos y preservación del flujo RPC de CC-025; GitHub marca mergeable=true y rama 0 commits detrás de develop.
- `828b7ab1` y `fddaca33` incorporaron guardas, separación documental y pruebas. Aún no se acredita GREEN/RED runtime de mutaciones independientes.
- Unit: 136/136 archivos, 2494/2494 tests PASS en GitHub Actions run `38984427873`. Typecheck/lint/build/audit/bundle PASS. DB/E2E Preview pendientes al redactar R2.
- `docs/tasks/log/T-357.md` y descripción de PR todavía describen el flujo documental antiguo y declaran completado un DoD no acreditado; deben corregirse antes de merge.

## Entregables y proceso

- [Ronda 1](revisiones/ronda-1.md), [ronda 2](revisiones/ronda-2.md) y [ronda 3](revisiones/ronda-3.md) y [ronda 4](revisiones/ronda-4.md) y [ronda 5](revisiones/ronda-5.md).
- [Hallazgos estructurados](hallazgos.jsonl).
- [Evidencia, comandos y harness independiente de ronda 1](evidencia/comandos.md) y [evidencia ronda 2](evidencia/ronda-2.md) y [evidencia ronda 3](evidencia/ronda-3.md) y [evidencia ronda 4](evidencia/ronda-4.md) y [evidencia ronda 5](evidencia/ronda-5.md).
- [Lecciones](lecciones.md).
- [Autorrevisión del autor conservada](autorrevision-agy-r1.md): el autor escribió el archivo `revisiones/ronda-1.md` previamente, contraviniendo AG-36; su texto se guardó intacto debajo de la nota de procedencia y **no** cuenta como revisión independiente.

Solo la revisión independiente actualiza esta carpeta. El autor debe escribir sus comprobaciones en `docs/tasks/log/T-357.md` y no marcar hallazgos como verificados. Después de cada arreglo se requiere otra ronda y pruebas RED→GREEN independientes antes de recomendar merge.

## R4 — estado actual

- CI para `25a0a5ea`: **136/136 archivos, 2528/2528 unit, DB PgTAP 26/2341, typecheck/lint/build/audit/bundle PASS**. 
- E2E para `25a0a5ea`: **82 Chromium PASS / 1 FAIL** por locator ambiguo en :1134 (tres intentos). Autor corrigió el locator en `523b4989` sin debilitar expectativa.
- E2E para `523b4989`: run `39014666112` **CANCELLED** y status `e2e-preview:error`. No hay evidencia de E2E PASS para ese HEAD.
- `develop` avanzó (~48 commits detrás al comparar con `523b4989`); GitHub indica `mergeable=true`, pero no revalidó integración E2E del código combinado. Resolver vía merge normal y verificar, nunca rebase.

## R5 — comprobaciones de cierre

- Merge real de `develop` en `7b2dadba` con dos padres `38e42bcd` + `293c3a27`: no se perdió ninguno de los seis archivos T-357 comparados. PR mergeable, sin conflictos.
- CI `39017572040` (run attempt 2): **138/138 archivos, 2551/2551 Vitest; 27 archivos / 2420 pgTAP PASS**, lint/typecheck/build/audit/bundle-budget/approval-policy/Vercel PASS. Build inicial falló en el loader de `next/font` Montserrat, en intento 2 PASS sin editar código. No afirmar que se conoce con certeza causa raíz del fallo transitorio.
- E2E trusted `39017634271` intento 2, job `117357103537`: checkout `7b2dadba`; **85/85 Chromium + 3/3 global settings PASS**, T-357 UI positivo, negativo RLS y viaje comercio con RPC incluidos. `e2e-preview:success` publicado sobre 7b2dadba.
- Desde 293c3a27, `develop` agregó **3 commits con únicamente documentación**: CC-029, plan y revisión de PR-395/T-369. Sin cambios en ejecutables ni tests. **No exigir nueva CI o E2E solamente por sincronizar esos documentos o actualizar bitácora/informe**; mantener trazabilidad del SHA de código validado.
- H01/H02/H03/H05 continúan `arreglado-sin-verificar` exclusivamente por el requisito de mutaciones runtime independientes del revisor, que no pudieron ejecutarse en este entorno; no fingirlas. No hay un nuevo defecto funcional reproducido en esos archivos.
