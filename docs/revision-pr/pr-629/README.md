# PR #629 — T-405 · Comercios según A03

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/629 |
| **Tarea** | T-405 · Fase 4 (#486) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-405-comercios-a03` → `develop` |
| **Base observada** | `fbd751aace5bcd476400ddad6ec40b29864c610f` |
| **Head revisado** | `ae38d57d34320a840b51db619ec6860af9cc8ed6` |
| **Tamaño** | 18 archivos, +1158 / -221 líneas (antes del commit de revisión) |
| **Estado** | CON BLOQUEANTES (1), PR abierta, sin aprobación ni merge |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `ae38d57d34320a840b51db619ec6860af9cc8ed6` | H01 (bloqueante), M01 (mejora) | [ronda-1.md](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR629-H01 | `Sheet side="right"` queda centrado | alto / bloqueante | abierto; corregir mediante CC separado [#630](https://github.com/cadeApp/cadeApp/issues/630) |
| PR629-H02 (M01) | Fecha fija del E2E caduca | bajo / mejora | abierto; autor de T-405 aplicará fecha dinámica |

> ID estructurado M01 = `PR629-H02`; la designación visible **M01** distingue la mejora de H01.

Datos: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia: [comandos.md](evidencia/comandos.md) · Lecciones: [lecciones.md](lecciones.md).

## Decisiones de Lautaro073 (2026-11-06)

- D01=A: action de lectura bajo demanda, con validación Zod y admin AAL2; ampliación acotada de ficha aceptada.
- D02=A: conservar «Abono y piloto».
- D03=A: colores `default` para piloto y `verified` para activo.
- D04=B: resolver H01 en el componente compartido `src/ui/sheet.tsx` mediante un **CC liviano independiente**. Propuesta registrada en [issue #630](https://github.com/cadeApp/cadeApp/issues/630); asignar número CC únicamente tras reconciliar referencias remotas. Esta PR no cambia `src/ui/**`.

## Qué queda por hacer

1. Implementar, revisar y mergear a `develop` el CC de [#630](https://github.com/cadeApp/cadeApp/issues/630), con tests propios y regresión del menú admin.
2. Autor de T-405: aplicar M01 en `e2e/specs/publication-credits.global-settings.spec.ts` y registrar RED→GREEN real en bitácora.
3. Luego del merge del CC: actualizar la rama T-405 por **merge** de `origin/develop`, sin rebase, e incorporar al E2E de T-405 comprobación geométrica con Playwright.
4. Nueva ronda independiente: ejecutar pruebas y mutaciones, verificar SHA actualizado, revisar CI oficial/E2E y confirmar que ya no hay bloqueantes.

## Límite de evidencia

Ronda realizada con diff y archivos del SHA mediante GitHub conectado. Sin clon utilizable: DNS de `github.com` no disponible en el contenedor. No se ejecutaron Vitest, Playwright, `git merge-tree` ni una batería RED→GREEN independiente. Por eso toda constatación técnica está clasificada como **análisis por inspección**, y no hay `verificado_en_sha`. El estado de GitHub `mergeable=true` no reemplaza `git merge-tree`.
