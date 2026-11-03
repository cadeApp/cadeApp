# PR #582 — T-400 · Auditoría legible: motivos, nombres y etiquetas

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/582 |
| **Tarea** | T-400 (Fase 4) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-400-audit-readable` → `develop` |
| **Base** | `f4bd475bdec8378fa819fc75388fc505b808bd25` |
| **SHA revisado (R3)** | `3c4d3e56c0317f7e925941429aa8a672519be012` |
| **Tamaño** | 15 archivos, +793 / -54 líneas |
| **Estado** | **Ronda 3: CON BLOQUEANTES (1 nuevo, PR582-H04)**; PR Draft, sin aprobar ni mergear |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `9a25af62e93b65f04a384758327ce608d98d3e5c` | H01, H02 | [revisiones/ronda-1.md](revisiones/ronda-1.md) |
| 2 | `2764de210c4929ac2b5a6ea07357d441f1db3759` | H03 nuevo; H01/H02 con arreglos visibles | [revisiones/ronda-2.md](revisiones/ronda-2.md) |
| 3 | `3c4d3e56c0317f7e925941429aa8a672519be012` | H03 corregido por inspección; H04 nuevo | [revisiones/ronda-3.md](revisiones/ronda-3.md) |

## Estado por hallazgo

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR582-H01 | El recorte del motivo altera el dato auditado | medio | arreglado-sin-verificar (inspección + CI unit) |
| PR582-H02 | El catálogo dinámico no detecta ampliaciones de `p_action` | alto | arreglado-sin-verificar (inspección + CI unit) |
| PR582-H03 | Guard de `report_incident` acepta `return` inerte en comentarios/literales | alto | arreglado-sin-verificar (mutaciones del autor; inspección independiente) |
| PR582-H04 | El guard admite un retorno condicionado o un `return` en comentario anidado | alto | abierto |

[Datos estructurados](hallazgos.jsonl) · [Evidencia y comandos](evidencia/comandos.md) · [Lecciones](lecciones.md)

## Qué queda por hacer

1. **H04 bloqueante:** el test debe exigir una salida `RETURN` incondicional de la rama `report_incident`, no solo cualquier `return` antes de `elsif`. Debe descartar también comentarios PostgreSQL `/* */` anidados.
2. Ejecutar la batería independiente de ronda 3 en un worktree del SHA de código revisado: mutaciones `IF false`, `IF v_uid IS NULL`, comentarios anidados y controles ya corregidos de H03. El harness completo está en `evidencia/comandos.md`.
3. Volver a pedir revisión independiente; el cierre sin bloqueantes necesita los checks oficiales de **ese SHA**, en particular `e2e-preview` y el estado de `db-tests`, sin exigir nuevo CI por commits documentales del revisor.

**Alcance:** dos archivos cambiados por el autor desde el commit de ronda 2, `src/features/admin/audit-catalog.test.ts` y `docs/tasks/log/T-400.md`; todos permitidos. El autor no tocó `docs/revision-pr/pr-582/**`.

## Limitaciones

Sin clon accesible (DNS de GitHub) ni `pnpm` en el entorno del revisor. La batería independiente consistió en **ejecutar el algoritmo actual sobre el texto SQL real**, mutado solo en memoria, no Vitest ni PostgreSQL. Los resultados oficiales del CI se informan por SHA y no sustituyen una mutación RED del control. H01/H02/H03 permanecen conservadoramente `arreglado-sin-verificar`, sin inventar `verificado_en_sha`.
