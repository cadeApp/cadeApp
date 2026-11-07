# PR #582 — T-400 · Auditoría legible: motivos, nombres y etiquetas

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/582 |
| **Tarea** | T-400 (Fase 4) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-400-audit-readable` → `develop` |
| **Base** | `f4bd475bdec8378fa819fc75388fc505b808bd25` |
| **SHA revisado (R4)** | `9a0b6f5d2c6ca1811dc2c9000dbe2269a1714a3b` |
| **Tamaño** | 15 archivos, +793 / -54 líneas |
| **Estado** | **Ronda 4: SIN BLOQUEANTES DE IMPLEMENTACIÓN**; gates externos `db-tests`/`e2e-preview` pendientes al cierre; PR Draft, sin aprobar ni mergear |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `9a25af62e93b65f04a384758327ce608d98d3e5c` | H01, H02 | [revisiones/ronda-1.md](revisiones/ronda-1.md) |
| 2 | `2764de210c4929ac2b5a6ea07357d441f1db3759` | H03 nuevo; H01/H02 con arreglos visibles | [revisiones/ronda-2.md](revisiones/ronda-2.md) |
| 3 | `3c4d3e56c0317f7e925941429aa8a672519be012` | H03 corregido por inspección; H04 nuevo | [revisiones/ronda-3.md](revisiones/ronda-3.md) |
| 4 | `9a0b6f5d2c6ca1811dc2c9000dbe2269a1714a3b` | H01-H04 verificados mediante sondas JS del revisor sobre SQL real + CI unit; 0 nuevos | [revisiones/ronda-4.md](revisiones/ronda-4.md) |

## Estado por hallazgo

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR582-H01 | El recorte del motivo altera el dato auditado | medio | arreglado-verificado (sonda JS propia + CI unit) |
| PR582-H02 | El catálogo dinámico no detecta ampliaciones de `p_action` | alto | arreglado-verificado (sonda JS propia + CI unit) |
| PR582-H03 | Guard de `report_incident` acepta `return` inerte en comentarios/literales | alto | arreglado-verificado (sonda JS propia + CI unit) |
| PR582-H04 | El guard admite un retorno condicionado o un `return` en comentario anidado | alto | arreglado-verificado (sonda JS propia + CI unit) |

[Datos estructurados](hallazgos.jsonl) · [Evidencia y comandos](evidencia/comandos.md) · [Lecciones](lecciones.md)

## Resultado de ronda 4

**SIN BLOQUEANTES de implementación por revisión independiente.** Cuatro hallazgos históricos, cuatro corregidos y verificados con sondas de ejecución JS del revisor sobre los archivos recuperados de este SHA y el SQL real. La batería propia de ronda 4 acertó 17 de 17 casos (incluidos falsos verdes de la ronda 3). `pnpm`/Vitest **no** se ejecutaron localmente por falta de clon y herramienta; el job oficial `unit` del SHA `9a0b6f5d2c6ca1811dc2c9000dbe2269a1714a3b` está en `success`, 189 archivos.

**Gates previos al merge:** comprobar `db-tests` y `e2e-preview` del **SHA de código** (ambos pendientes al momento de la revisión). `approval-policy` falló porque el cuerpo de la PR aún decía que el informe independiente estaba pendiente; se actualizará ese campo sin alterar las demás secciones para que el workflow lo reevalúe. No se debe declarar el CI completo verde antes de ver esos resultados. La PR sigue Draft y no está aprobada ni mergeada.

**No exigir CI nuevo solo por este commit de documentación.** Si surge un fallo oficial de los gates, investigarlo antes de marcar la tarea mergeable; puede pedir otra ronda si exige modificar código.

## Limitaciones

La ejecución directa de `pnpm exec vitest`, `git merge-tree` y `node docs/revision-pr/analizar.mjs verificacion` contra un clon real sigue sin estar disponible: `github.com` no resuelve desde este contenedor y `pnpm` no está instalado. Se documentan separadamente sondas JS independientes, resultados del autor y logs oficiales por SHA.
